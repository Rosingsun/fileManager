import crypto from 'crypto'
import sharp from 'sharp'

/**
 * 相似照片指纹与打分（纯算法层，无 Electron/IPC 依赖，评估脚本可直接 import）。
 *
 * 与旧实现的本质区别：
 *  - 旧：8x8 灰度「逐像素比全局均值」= aHash，无 DCT、无色彩、无结构
 *  - 新：32x32 灰度 DCT 低频 pHash + 9x8 梯度 dHash + 4x4 颜色布局 + 宽高比
 *  - 全程 EXIF 转正；一次解码同时产出所有指纹
 */

/** 64 位哈希拆成两个 32 位整数，避免逐字符比较 */
export interface Hash64 {
  hi: number
  lo: number
}

/** 单张图片的完整指纹 */
export interface ImageFingerprint {
  pHash: Hash64
  dHash: Hash64
  /** 4x4 网格 RGB 均值 + 亮度均值/标准差，值域 0..1，共 50 维 */
  colorLayout: number[]
  aspectRatio: number
  width: number
  height: number
  /** 拉普拉斯方差，用于「推荐保留」时体现清晰度 */
  sharpness: number
}

export interface PairSimilarity {
  /** 综合相似度 0..100 */
  score: number
  pHashSim: number
  dHashSim: number
  colorSim: number
  aspectSim: number
}

/** 运行时标定参数；由 scripts/calibrate-similarity.ts 网格搜索写回 */
export interface SimilarityCalibration {
  version: number
  weights: { pHash: number; dHash: number; color: number; aspect: number }
  /** 综合分阈值（0..100），对应 UI 滑块 */
  threshold: number
  /** pHash 汉明距离硬上限：超过则即使综合分达标也不判近重复 */
  maxPHashDistance: number
  /** 颜色布局距离硬上限（0..1） */
  maxColorDistance: number
  /** CLIP 语义余弦阈值（0..1），仅 scene 档启用 */
  semanticThreshold: number
  metrics?: Record<string, unknown>
}

export const DEFAULT_CALIBRATION: SimilarityCalibration = {
  version: 2,
  weights: { pHash: 0.56, dHash: 0.22, color: 0.15, aspect: 0.07 },
  threshold: 88,
  maxPHashDistance: 18,
  maxColorDistance: 0.26,
  semanticThreshold: 0.93
}

// ---------------------------------------------------------------- DCT 常量

const DCT_N = 32
const DCT_LOW = 8
/** DCT-II 变换矩阵的前 8 行：COS[u][x] = scale(u) * cos((2x+1)uπ/2N) */
const DCT8: Float64Array[] = (() => {
  const rows: Float64Array[] = []
  for (let u = 0; u < DCT_LOW; u++) {
    const row = new Float64Array(DCT_N)
    const scale = u === 0 ? Math.sqrt(1 / DCT_N) : Math.sqrt(2 / DCT_N)
    for (let x = 0; x < DCT_N; x++) {
      row[x] = scale * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * DCT_N))
    }
    rows.push(row)
  }
  return rows
})()

// ---------------------------------------------------------------- 位运算

function popcount32(v: number): number {
  let x = v | 0
  x = x - ((x >>> 1) & 0x55555555)
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  x = (x + (x >>> 4)) & 0x0f0f0f0f
  x = x + (x >>> 8)
  x = x + (x >>> 16)
  return x & 0x3f
}

function hammingDistance(a: Hash64, b: Hash64): number {
  return popcount32(a.hi ^ b.hi) + popcount32(a.lo ^ b.lo)
}

export function hashToHex(h: Hash64): string {
  return (h.hi >>> 0).toString(16).padStart(8, '0') + (h.lo >>> 0).toString(16).padStart(8, '0')
}

export function hexToHash(hex: string): Hash64 {
  return { hi: parseInt(hex.slice(0, 8), 16) | 0, lo: parseInt(hex.slice(8, 16), 16) | 0 }
}

// ---------------------------------------------------------------- 指纹提取

/** 32x32 灰度 → 可分离 DCT 前 8x8 → 与中位数比较得 64 位 pHash */
function perceptualHash(gray: Float64Array): Hash64 {
  // B = DCT8 (8x32) × gray (32x32) → 8x32
  const tmp = new Float64Array(DCT_LOW * DCT_N)
  for (let u = 0; u < DCT_LOW; u++) {
    const row = DCT8[u]
    for (let x = 0; x < DCT_N; x++) {
      let s = 0
      for (let y = 0; y < DCT_N; y++) s += gray[y * DCT_N + x] * row[y]
      tmp[u * DCT_N + x] = s
    }
  }
  // D = tmp (8x32) × DCT8ᵀ (32x8) → 8x8 低频
  const coeff = new Float64Array(DCT_LOW * DCT_LOW)
  for (let u = 0; u < DCT_LOW; u++) {
    for (let v = 0; v < DCT_LOW; v++) {
      let s = 0
      const rowV = DCT8[v]
      for (let x = 0; x < DCT_N; x++) s += tmp[u * DCT_N + x] * rowV[x]
      coeff[u * DCT_LOW + v] = s
    }
  }
  // 排除 DC 后取中位数作为二值化基准（标准 pHash）
  const rest = Array.from(coeff.slice(1)).sort((a, b) => a - b)
  const median = rest[Math.floor(rest.length / 2)]

  let hi = 0
  let lo = 0
  for (let i = 0; i < 64; i++) {
    const bit = coeff[i] > median ? 1 : 0
    if (i < 32) hi = (hi << 1) | bit
    else lo = (lo << 1) | bit
  }
  return { hi: hi | 0, lo: lo | 0 }
}

/** 32x32 灰度重采样到 9x8 → 相邻列梯度比较得 64 位 dHash */
function differenceHash(gray: Float64Array): Hash64 {
  const W = 9
  const H = 8
  const small = new Float64Array(W * H)
  for (let y = 0; y < H; y++) {
    const sy = Math.min(DCT_N - 1, Math.floor(((y + 0.5) * DCT_N) / H))
    for (let x = 0; x < W; x++) {
      const sx = Math.min(DCT_N - 1, Math.floor(((x + 0.5) * DCT_N) / W))
      small[y * W + x] = gray[sy * DCT_N + sx]
    }
  }
  let hi = 0
  let lo = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      const bit = small[y * W + x] > small[y * W + x + 1] ? 1 : 0
      const i = y * (W - 1) + x
      if (i < 32) hi = (hi << 1) | bit
      else lo = (lo << 1) | bit
    }
  }
  return { hi: hi | 0, lo: lo | 0 }
}

/** 4x4 网格 RGB 均值 + 亮度均值/标准差，共 50 维，值域 0..1 */
function colorLayout(rgb: Buffer, channels: number, side: number): number[] {
  const grid = 4
  const cell = side / grid
  const sums = new Float64Array(grid * grid * 3)
  const counts = new Float64Array(grid * grid)
  const lum: number[] = []
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const p = (y * side + x) * channels
      const r = rgb[p] / 255
      const g = rgb[p + 1] / 255
      const b = rgb[p + 2] / 255
      const gi = Math.min(grid - 1, Math.floor(y / cell)) * grid + Math.min(grid - 1, Math.floor(x / cell))
      sums[gi * 3] += r
      sums[gi * 3 + 1] += g
      sums[gi * 3 + 2] += b
      counts[gi]++
      lum.push(0.299 * r + 0.587 * g + 0.114 * b)
    }
  }
  const out: number[] = []
  for (let i = 0; i < grid * grid; i++) {
    const n = Math.max(1, counts[i])
    out.push(sums[i * 3] / n, sums[i * 3 + 1] / n, sums[i * 3 + 2] / n)
  }
  const mean = lum.reduce((a, b) => a + b, 0) / Math.max(1, lum.length)
  let variance = 0
  for (const l of lum) variance += (l - mean) ** 2
  out.push(mean, Math.sqrt(variance / Math.max(1, lum.length)))
  return out
}

/** 从单个 buffer 提取全部指纹：一次 EXIF 转正 + 一次 32x32 解码 */
export async function extractFingerprint(imageBuffer: Buffer): Promise<ImageFingerprint> {
  const side = 32
  const meta = await sharp(imageBuffer).metadata()
  // EXIF orientation 5~8 表示需 90° 旋转，宽高需交换
  const rotated = (meta.orientation ?? 1) >= 5
  const width = rotated ? (meta.height ?? side) : (meta.width ?? side)
  const height = rotated ? (meta.width ?? side) : (meta.height ?? side)

  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .resize(side, side, { fit: 'fill', kernel: 'lanczos3' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = info.channels
  const gray = new Float64Array(side * side)
  for (let i = 0; i < side * side; i++) {
    const p = i * channels
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }

  // 拉普拉斯方差：模糊图显著低于清晰图（同一次解码，无额外 IO）
  let lapSum = 0
  let lapSq = 0
  let lapCount = 0
  for (let y = 1; y < side - 1; y++) {
    for (let x = 1; x < side - 1; x++) {
      const i = y * side + x
      const lap =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - side] - gray[i + side]
      lapSum += lap
      lapSq += lap * lap
      lapCount++
    }
  }
  const sharpness = Math.sqrt(Math.max(0, lapSq / Math.max(1, lapCount) - (lapSum / Math.max(1, lapCount)) ** 2))

  return {
    pHash: perceptualHash(gray),
    dHash: differenceHash(gray),
    colorLayout: colorLayout(data, channels, side),
    aspectRatio: Math.max(width, height) / Math.max(1, Math.min(width, height)),
    width,
    height,
    sharpness
  }
}

// ---------------------------------------------------------------- 打分

function colorDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (!n) return 1
  let s = 0
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i])
  return s / n
}

/** 与标定无关的原始分项；评估脚本与运行时共用，保证公式严格一致 */
export interface PairParts {
  pDist: number
  dDist: number
  cDist: number
  pHashSim: number
  dHashSim: number
  colorSim: number
  aspectSim: number
}

export function computePairParts(a: ImageFingerprint, b: ImageFingerprint): PairParts {
  const pDist = hammingDistance(a.pHash, b.pHash)
  const dDist = hammingDistance(a.dHash, b.dHash)
  const cDist = colorDistance(a.colorLayout, b.colorLayout)
  const ratio = Math.min(a.aspectRatio, b.aspectRatio) / Math.max(1e-6, Math.max(a.aspectRatio, b.aspectRatio))
  return {
    pDist,
    dDist,
    cDist,
    pHashSim: (1 - pDist / 64) * 100,
    dHashSim: (1 - dDist / 64) * 100,
    colorSim: Math.max(0, 1 - cDist) * 100,
    aspectSim: ratio * 100
  }
}

/** 纯打分：离线标定网格搜索与运行时走同一个函数 */
export function scorePairParts(
  parts: PairParts,
  calibration: SimilarityCalibration,
  thresholdOverride?: number
): number {
  const w = calibration.weights
  const wSum = w.pHash + w.dHash + w.color + w.aspect || 1
  let score =
    (w.pHash * parts.pHashSim + w.dHash * parts.dHashSim + w.color * parts.colorSim + w.aspect * parts.aspectSim) / wSum
  const threshold = thresholdOverride ?? calibration.threshold
  // 硬门控：结构或颜色差异过大时，不允许靠其它分项把分数拉过阈值
  if (parts.pDist > calibration.maxPHashDistance || parts.cDist > calibration.maxColorDistance) {
    score = Math.min(score, threshold - 1)
  }
  return score
}

/** 两张图的综合相似度；返回各分项，供 UI 展示判定依据 */
export function compareFingerprints(
  a: ImageFingerprint,
  b: ImageFingerprint,
  calibration: SimilarityCalibration = DEFAULT_CALIBRATION
): PairSimilarity {
  const parts = computePairParts(a, b)
  return {
    score: scorePairParts(parts, calibration),
    pHashSim: parts.pHashSim,
    dHashSim: parts.dHashSim,
    colorSim: parts.colorSim,
    aspectSim: parts.aspectSim
  }
}

/** 仅用于兼容旧调用：返回 pHash 的 hex 字符串 */
export async function calculatePerceptualHash(imageBuffer: Buffer): Promise<string> {
  try {
    return hashToHex((await extractFingerprint(imageBuffer)).pHash)
  } catch (error) {
    console.error('[Similarity] 计算感知哈希失败:', error)
    return ''
  }
}

export function calculateFileHash(fileBuffer: Buffer): string {
  return crypto.createHash('md5').update(fileBuffer).digest('hex')
}

/** 兼容旧调用：两个 hex 哈希的相似度百分比 */
export function calculateSimilarity(hash1: string, hash2: string): number {
  if (hash1.length !== 16 || hash2.length !== 16) return 0
  const dist = hammingDistance(hexToHash(hash1), hexToHash(hash2))
  return Math.round((1 - dist / 64) * 10000) / 100
}

/** 语义向量余弦相似度（输入需已 L2 归一化，未归一化时也会就地归一） */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length)
  if (!n) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na * nb)
  return denom > 1e-12 ? dot / denom : 0
}

/** 推荐保留：像素优先，其次体积、时间；画质信号（清晰度）由 service 层补充 */
export function recommendKeepImage(images: Array<{
  filePath: string
  width?: number
  height?: number
  size: number
  modifiedTime: number
  sharpness?: number
}>): string {
  if (images.length === 0) return ''
  if (images.length === 1) return images[0].filePath

  const maxPixels = Math.max(1, ...images.map(i => (i.width || 0) * (i.height || 0)))
  const maxSize = Math.max(1, ...images.map(i => i.size))
  const maxTime = Math.max(1, ...images.map(i => i.modifiedTime))
  const maxSharp = Math.max(0.001, ...images.map(i => i.sharpness ?? 0))

  const scored = images.map(img => {
    let score = ((img.width || 0) * (img.height || 0) / maxPixels) * 35
    score += (img.size / maxSize) * 25
    score += (img.modifiedTime / maxTime) * 10
    if (img.sharpness !== undefined) score += (img.sharpness / maxSharp) * 30
    return { path: img.filePath, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0].path
}
