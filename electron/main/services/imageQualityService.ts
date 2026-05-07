import sharp from 'sharp'
import fs from 'fs-extra'
import type {
  ImageQualityScanConfig,
  ImageQualityItemResult,
  ImageQualityScanResult,
  ImageQualityScanProgress,
  ImageQualityThresholds,
  ImageQualityFlag,
  ImageQualityScores,
  SimilarityScanConfig
} from '../../../src/types'
import { DEFAULT_IMAGE_QUALITY_THRESHOLDS } from '../../../src/types'
import { scanImageFiles } from './similarityService'

const LARGE_FILE_BYTES = 50 * 1024 * 1024

function mergeThresholds(partial?: Partial<ImageQualityThresholds>): ImageQualityThresholds {
  return { ...DEFAULT_IMAGE_QUALITY_THRESHOLDS, ...partial }
}

function collectPathsConfig(config: ImageQualityScanConfig): SimilarityScanConfig {
  return {
    scanPath: config.scanPath,
    includeSubdirectories: config.includeSubdirectories,
    minFileSize: config.minFileSize,
    maxFileSize: config.maxFileSize,
    excludedFolders: config.excludedFolders,
    excludedExtensions: config.excludedExtensions,
    similarityThreshold: 90,
    algorithm: 'hash'
  }
}

function analyzeLumaAndGrid(
  luma: Uint8Array,
  w: number,
  h: number,
  thresholds: ImageQualityThresholds
): {
  scores: ImageQualityScores
  flags: ImageQualityFlag[]
  compositionHints: string[]
} {
  const n = w * h
  let sum = 0
  let sumSq = 0
  let hiClip = 0
  let shClip = 0
  const hist = new Uint32Array(256)
  for (let i = 0; i < n; i++) {
    const v = luma[i]
    sum += v
    sumSq += v * v
    hist[v]++
    if (v >= 250) hiClip++
    if (v <= 5) shClip++
  }
  const meanLuma = sum / n
  const variance = Math.max(0, sumSq / n - meanLuma * meanLuma)
  const lumaStd = Math.sqrt(variance)
  const highlightClipRatio = hiClip / n
  const shadowClipRatio = shClip / n

  const grid = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  let totalG = 0
  let sumXG = 0
  let sumYG = 0
  let sumG = 0

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx = Math.abs(luma[i + 1] - luma[i - 1])
      const gy = Math.abs(luma[i + w] - luma[i - w])
      const g = gx + gy
      if (g <= 0) continue
      const col = Math.min(2, Math.floor((x * 3) / w))
      const row = Math.min(2, Math.floor((y * 3) / h))
      const cell = row * 3 + col
      grid[cell] += g
      totalG += g
      sumXG += x * g
      sumYG += y * g
      sumG += g
    }
  }

  const centerCellEnergyRatio = totalG > 0 ? grid[4] / totalG : 0

  let gridEntropy = 0
  if (totalG > 0) {
    for (let c = 0; c < 9; c++) {
      const p = grid[c] / totalG
      if (p > 0) gridEntropy -= p * Math.log2(p + 1e-12)
    }
  }

  const nx = sumG > 0 ? sumXG / sumG / Math.max(1, w - 1) : 0.5
  const ny = sumG > 0 ? sumYG / sumG / Math.max(1, h - 1) : 0.5
  const thirds: Array<[number, number]> = [
    [1 / 3, 1 / 3],
    [2 / 3, 1 / 3],
    [1 / 3, 2 / 3],
    [2 / 3, 2 / 3]
  ]
  let minThirdsDistance = 1
  for (const [tx, ty] of thirds) {
    const d = Math.hypot(nx - tx, ny - ty)
    if (d < minThirdsDistance) minThirdsDistance = d
  }
  const centroidOffsetNorm = Math.hypot(nx - 0.5, ny - 0.5)

  const scores: ImageQualityScores = {
    meanLuma,
    lumaStd,
    highlightClipRatio,
    shadowClipRatio,
    gridEntropy,
    centroidOffsetNorm,
    centerCellEnergyRatio,
    minThirdsDistance
  }

  const flags: ImageQualityFlag[] = []
  const compositionHints: string[] = []

  if (highlightClipRatio >= thresholds.highlightClipRatio || meanLuma >= thresholds.overexposedMeanLuma) {
    flags.push('overexposed')
    compositionHints.push('可能过曝（高光裁剪或整体偏亮）')
  }
  if (shadowClipRatio >= thresholds.shadowClipRatio || meanLuma <= thresholds.underexposedMeanLuma) {
    flags.push('underexposed')
    compositionHints.push('可能欠曝（暗部裁剪或整体偏暗）')
  }
  if (lumaStd <= thresholds.lowContrastStd) {
    flags.push('lowContrast')
    compositionHints.push('对比度偏低（画面可能偏灰）')
  }

  if (w >= 48 && h >= 48 && totalG > 0) {
    if (centerCellEnergyRatio >= thresholds.compositionCenterEnergyRatio) {
      flags.push('subjectVeryCentered')
      compositionHints.push('主体可能过于集中在画面中心（启发式）')
    }
    if (minThirdsDistance >= thresholds.compositionCentroidOffThirdsMin) {
      flags.push('subjectOffThirds')
      compositionHints.push('视觉重心可能偏离三分区（启发式）')
    }
    const ne = thresholds.compositionNearEdge
    if (nx <= ne || nx >= 1 - ne || ny <= ne || ny >= 1 - ne) {
      flags.push('subjectNearEdge')
      compositionHints.push('主体可能贴近画面边缘（启发式）')
    }
  }

  return { scores, flags, compositionHints }
}

async function analyzeImageFile(
  filePath: string,
  analysisLongEdge: number,
  thresholds: ImageQualityThresholds
): Promise<ImageQualityItemResult> {
  let metaW = 0
  let metaH = 0
  try {
    const meta = await sharp(filePath).metadata()
    metaW = meta.width || 0
    metaH = meta.height || 0
  } catch {
    metaW = 0
    metaH = 0
  }

  try {
    const { data, info } = await sharp(filePath)
      .rotate()
      .resize({
        width: analysisLongEdge,
        height: analysisLongEdge,
        fit: 'inside',
        withoutEnlargement: false
      })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const w = info.width
    const h = info.height
    const ch = info.channels
    const n = w * h
    if (w < 8 || h < 8 || n === 0) {
      return {
        filePath,
        ok: false,
        error: '图片尺寸过小',
        width: metaW,
        height: metaH,
        flags: [],
        compositionHints: [],
        scores: {
          meanLuma: 0,
          lumaStd: 0,
          highlightClipRatio: 0,
          shadowClipRatio: 0,
          gridEntropy: 0,
          centroidOffsetNorm: 0,
          centerCellEnergyRatio: 0,
          minThirdsDistance: 0
        }
      }
    }

    const luma = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      const b = i * ch
      let r = data[b]
      let g = ch >= 2 ? data[b + 1] : r
      let bch = ch >= 3 ? data[b + 2] : r
      const y = Math.round((299 * r + 587 * g + 114 * bch) / 1000)
      luma[i] = y > 255 ? 255 : y < 0 ? 0 : y
    }

    const { scores, flags, compositionHints } = analyzeLumaAndGrid(luma, w, h, thresholds)

    return {
      filePath,
      ok: true,
      width: metaW || w,
      height: metaH || h,
      flags,
      compositionHints,
      scores
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      filePath,
      ok: false,
      error: msg,
      width: metaW,
      height: metaH,
      flags: [],
      compositionHints: [],
      scores: {
        meanLuma: 0,
        lumaStd: 0,
        highlightClipRatio: 0,
        shadowClipRatio: 0,
        gridEntropy: 0,
        centroidOffsetNorm: 0,
        centerCellEnergyRatio: 0,
        minThirdsDistance: 0
      }
    }
  }
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function runOne(): Promise<void> {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => runOne())
  await Promise.all(runners)
  return results
}

export async function scanImageQuality(
  config: ImageQualityScanConfig,
  onProgress: (p: Partial<ImageQualityScanProgress>) => void,
  isCancelled: () => boolean
): Promise<ImageQualityScanResult> {
  const start = Date.now()
  const thresholds = mergeThresholds(config.thresholds)
  const analysisLongEdge = Math.min(1024, Math.max(256, config.analysisLongEdge ?? 640))
  const maxConcurrent = Math.min(8, Math.max(1, config.maxConcurrent ?? 3))

  onProgress({ status: 'scanning', current: 0, total: 0, currentFile: '正在扫描图片…' })
  const paths = await scanImageFiles(collectPathsConfig(config))

  const skipped: Array<{ path: string; reason: string }> = []
  const toAnalyze: string[] = []

  for (const p of paths) {
    if (isCancelled()) break
    try {
      const st = await fs.stat(p)
      if (st.size > LARGE_FILE_BYTES) {
        skipped.push({ path: p, reason: '文件超过 50MB，已跳过分析' })
        continue
      }
      toAnalyze.push(p)
    } catch {
      skipped.push({ path: p, reason: '无法读取文件信息' })
    }
  }

  const total = toAnalyze.length
  if (isCancelled()) {
    onProgress({ status: 'cancelled', current: 0, total, currentFile: undefined })
    return { items: [], skipped, totalImages: 0, scanTime: Date.now() - start }
  }

  if (total === 0) {
    onProgress({ status: 'completed', current: 0, total: 0 })
    return { items: [], skipped, totalImages: 0, scanTime: Date.now() - start }
  }

  onProgress({ status: 'analyzing', current: 0, total })
  let completed = 0

  const items = await runPool(
    toAnalyze,
    maxConcurrent,
    async (filePath) => {
      if (isCancelled()) {
        return {
          filePath,
          ok: false,
          error: '已取消',
          width: 0,
          height: 0,
          flags: [],
          compositionHints: [],
          scores: {
            meanLuma: 0,
            lumaStd: 0,
            highlightClipRatio: 0,
            shadowClipRatio: 0,
            gridEntropy: 0,
            centroidOffsetNorm: 0,
            centerCellEnergyRatio: 0,
            minThirdsDistance: 0
          }
        } satisfies ImageQualityItemResult
      }
      const r = await analyzeImageFile(filePath, analysisLongEdge, thresholds)
      completed++
      onProgress({
        status: 'analyzing',
        current: completed,
        total,
        currentFile: filePath
      })
      return r
    },
  )

  const finalStatus = isCancelled() ? 'cancelled' : 'completed'
  onProgress({
    status: finalStatus,
    current: completed,
    total,
    currentFile: undefined
  })

  return {
    items,
    skipped,
    totalImages: items.length,
    scanTime: Date.now() - start
  }
}