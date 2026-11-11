import { join, extname } from 'path'
import { stat, readdir, readFile } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import { getModelsDir, getClassificationModelPath } from '../utils/classificationModels'
import { resolveProjectRoot } from '../utils/projectRoot'
import { getClipSession, encodeClipImagePixels } from '../utils/clipClassifier'
import { preprocessImage } from '../utils/classificationPreprocess'
import { IMAGE_EXTENSIONS } from '../utils/fileUtils'
import {
  calculateFileHash,
  extractFingerprint,
  DEFAULT_CALIBRATION,
  type SimilarityCalibration
} from '../utils/similarityUtils'
import { groupFingerprints, type FingerprintRecord } from '../utils/similarityGrouping'
import type {
  SimilarityScanConfig,
  SimilarityScanProgress,
  SimilarityScanResult,
  SimilarityDetectionMode,
  SimilarityGroup
} from '../../../src/types'

const CALIBRATION_FILE = 'similarity-calibration.json'
const CLIP_INPUT_SIZE = 224
const DECODE_CONCURRENCY = 4

export function loadSimilarityCalibration(cwd?: string): SimilarityCalibration {
  const path = join(getModelsDir(cwd ?? resolveProjectRoot()), CALIBRATION_FILE)
  if (!existsSync(path)) return { ...DEFAULT_CALIBRATION }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<SimilarityCalibration>
    if (raw.version !== 2) return { ...DEFAULT_CALIBRATION }
    return {
      ...DEFAULT_CALIBRATION,
      ...raw,
      weights: { ...DEFAULT_CALIBRATION.weights, ...(raw.weights || {}) }
    }
  } catch (e) {
    console.warn('[Similarity] 标定文件解析失败，使用默认参数', e)
    return { ...DEFAULT_CALIBRATION }
  }
}

/** 三档：优先新字段，兼容旧 algorithm 值 */
export function resolveDetectionMode(config: SimilarityScanConfig): SimilarityDetectionMode {
  if (config.detectionMode) return config.detectionMode
  if (config.algorithm === 'hash') return 'exact'
  return 'near'
}

export async function scanImageFiles(config: SimilarityScanConfig): Promise<string[]> {
  const imageFiles: string[] = []
  const excludedPaths = new Set(config.excludedFolders || [])
  const excludedExts = new Set((config.excludedExtensions || []).map(ext => ext.toLowerCase()))

  async function traverse(currentPath: string) {
    let items: string[]
    try {
      items = await readdir(currentPath)
    } catch (error) {
      console.error(`[Similarity] 遍历目录失败 ${currentPath}:`, error)
      return
    }
    for (const item of items) {
      const fullPath = join(currentPath, item)
      let stats
      try {
        stats = await stat(fullPath)
      } catch {
        continue
      }
      if (stats.isDirectory()) {
        if (!excludedPaths.has(fullPath) && config.includeSubdirectories) await traverse(fullPath)
      } else {
        const ext = extname(item).slice(1).toLowerCase()
        if (IMAGE_EXTENSIONS.includes(ext) && !excludedExts.has(ext)) {
          if (config.minFileSize && stats.size < config.minFileSize) continue
          if (config.maxFileSize && stats.size > config.maxFileSize) continue
          imageFiles.push(fullPath)
        }
      }
    }
  }

  await traverse(config.scanPath)
  return imageFiles
}

export interface ScanRuntime {
  onProgress: (progress: Partial<SimilarityScanProgress>) => void
  isCancelled: () => boolean
}

/** CLIP 视觉嵌入（scene 档）。模型缺失时返回 null，降级为不产出 scene 组 */
async function computeClipEmbedding(
  filePath: string,
  session: Awaited<ReturnType<typeof getClipSession>>
): Promise<Float32Array | null> {
  if (!session) return null
  try {
    const pixels = await preprocessImage(filePath, CLIP_INPUT_SIZE, 'clip')
    return await encodeClipImagePixels(session, pixels, CLIP_INPUT_SIZE)
  } catch (e) {
    console.warn(`[Similarity] CLIP 推理失败 ${filePath}:`, e)
    return null
  }
}

/**
 * 有限并发地提取指纹：worker 池持续取任务，避免串行整文件读取。
 * 取消标志在每个任务边界检查，取消后立即停止派发。
 */
async function extractRecords(
  files: string[],
  mode: SimilarityDetectionMode,
  cwd: string,
  runtime: ScanRuntime
): Promise<{ records: FingerprintRecord[]; decodeFailures: number; semanticAvailable: boolean }> {
  const records: FingerprintRecord[] = []
  let cursor = 0
  let done = 0
  let decodeFailures = 0
  const total = files.length

  const clipPath = mode === 'scene' ? getClassificationModelPath('clip_vit_b32_quant', cwd) : ''
  const clipSession = mode === 'scene' && existsSync(clipPath)
    ? await getClipSession(clipPath)
    : null
  const semanticAvailable = !!clipSession
  if (mode === 'scene' && !semanticAvailable) {
    console.warn('[Similarity] 未找到 CLIP B/32 视觉模型，scene 档降级为 near 档：', clipPath)
  }

  async function worker() {
    while (true) {
      if (runtime.isCancelled()) return
      const i = cursor++
      if (i >= total) return
      const filePath = files[i]
      try {
        const buffer = await readFile(filePath)
        const fileHash = calculateFileHash(buffer)
        const st = await stat(filePath)
        const fp = await extractFingerprint(buffer)
        const record: FingerprintRecord = {
          filePath,
          fileHash,
          size: st.size,
          modifiedTime: st.mtime.getTime(),
          width: fp.width,
          height: fp.height,
          sharpness: fp.sharpness,
          fp
        }
        if (clipSession) {
          record.clipEmb = (await computeClipEmbedding(filePath, clipSession)) ?? undefined
        }
        records.push(record)
      } catch (e) {
        // RAW 等无法解码的文件仍保留 MD5，但不参与感知/语义比较
        decodeFailures++
        try {
          const buffer = await readFile(filePath)
          const st = await stat(filePath)
          records.push({
            filePath,
            fileHash: calculateFileHash(buffer),
            size: st.size,
            modifiedTime: st.mtime.getTime(),
            decodeError: e instanceof Error ? e.message.slice(0, 120) : String(e)
          })
        } catch {
          /* 完全不可读，跳过 */
        }
      }
      done++
      if (done % 5 === 0 || done === total) {
        runtime.onProgress({
          status: 'hashing',
          current: done,
          total,
          currentFile: filePath,
          stagePercent: Math.round((done / total) * 100),
          stageLabel: clipSession ? '提取指纹与 CLIP 语义' : '提取图像指纹'
        })
      }
    }
  }

  const pool = Array.from(
    { length: Math.min(DECODE_CONCURRENCY, total) },
    () => worker()
  )
  await Promise.all(pool)
  return { records, decodeFailures, semanticAvailable }
}

export async function scanSimilarImages(
  config: SimilarityScanConfig,
  onProgress: (progress: Partial<SimilarityScanProgress>) => void,
  isCancelled: () => boolean = () => false
): Promise<SimilarityScanResult> {
  const startTime = Date.now()
  const cwd = resolveProjectRoot()
  const calibration = loadSimilarityCalibration(cwd)
  const mode = resolveDetectionMode(config)
  const threshold = Number(config.similarityThreshold) || calibration.threshold

  onProgress({ status: 'scanning', currentFile: '正在扫描图片文件…', groupsFound: 0 })
  const imageFiles = await scanImageFiles(config)
  const totalFiles = imageFiles.length

  if (totalFiles === 0 || isCancelled()) {
    return {
      groups: [], totalImages: 0, totalGroups: 0, potentialSpaceSaved: 0,
      scanTime: Date.now() - startTime,
      stats: {
        pairsCompared: 0, decodeFailures: 0, exactGroups: 0, nearGroups: 0,
        sceneGroups: 0, semanticAvailable: false, cancelled: isCancelled(), threshold
      }
    }
  }

  onProgress({ status: 'hashing', current: 0, total: totalFiles, groupsFound: 0 })
  const { records, decodeFailures, semanticAvailable } = await extractRecords(
    imageFiles, mode, cwd, { onProgress, isCancelled }
  )

  if (isCancelled()) {
    return {
      groups: [], totalImages: records.length, totalGroups: 0, potentialSpaceSaved: 0,
      scanTime: Date.now() - startTime,
      stats: {
        pairsCompared: 0, decodeFailures, exactGroups: 0, nearGroups: 0,
        sceneGroups: 0, semanticAvailable, cancelled: true, threshold
      }
    }
  }

  onProgress({
    status: mode === 'scene' ? 'semantic' : 'comparing',
    current: totalFiles, total: totalFiles, groupsFound: 0,
    stageLabel: '比对相似照片', stagePercent: 0
  })

  const grouped = await groupFingerprints(records, {
    mode,
    threshold,
    calibration,
    isCancelled,
    onProgress: (percent, label) => onProgress({
      status: label.includes('CLIP') ? 'semantic' : 'comparing',
      current: totalFiles, total: totalFiles,
      stagePercent: percent, stageLabel: label
    })
  })

  let potentialSpaceSaved = 0
  for (const group of grouped.groups) {
    // 仅安全组计入可释放空间；scene 组仅供参考
    if (!group.safeToDelete) continue
    const keepPath = group.recommendedKeep || group.images[0]?.filePath
    for (const img of group.images) {
      if (img.filePath !== keepPath) potentialSpaceSaved += img.size
    }
  }

  onProgress({
    status: 'completed',
    current: totalFiles, total: totalFiles,
    groupsFound: grouped.groups.length, stagePercent: 100
  })

  return {
    groups: grouped.groups,
    totalImages: records.length,
    totalGroups: grouped.groups.length,
    potentialSpaceSaved,
    scanTime: Date.now() - startTime,
    stats: {
      pairsCompared: grouped.pairsCompared,
      decodeFailures,
      exactGroups: grouped.exactGroups,
      nearGroups: grouped.nearGroups,
      sceneGroups: grouped.sceneGroups,
      semanticAvailable,
      cancelled: false,
      threshold
    }
  }
}

/** 汇总用：统计各档位分组数（供评估与文档） */
export function countTiers(groups: SimilarityGroup[]): Record<string, number> {
  const out = { exact: 0, near: 0, scene: 0 }
  for (const g of groups) out[g.tier]++
  return out
}
