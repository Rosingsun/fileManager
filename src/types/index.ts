/** 媒体资源类型（RAW / Apple Live / 普通图） */
export type MediaAssetKind = 'standard' | 'raw' | 'live'

export interface MediaAssetInfo {
  kind: MediaAssetKind
  stillPath: string
  liveVideoPath?: string
  rawUsesEmbeddedPreview?: boolean
  contentIdentifier?: string
}

// 文件信息类型
export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedTime: number
  createdTime: number
}

/** 主进程分页读取目录的入参 */
export interface DirectoryPageRequest {
  offset: number
  limit: number
  /** 可选扩展名过滤（不含点号、忽略大小写）；仅过滤文件，文件夹始终保留 */
  extensions?: string[]
}

/** 主进程分页读取目录的返回 */
export interface DirectoryPageResult {
  /** 当前页条目（已 stat，按「文件夹在前→名称」稳定排序切片） */
  items: FileInfo[]
  /** 过滤后条目总数（不含扩展名过滤时等于目录条目总数） */
  totalCount: number
  /** offset + items.length < totalCount，供滚动触底判断 */
  hasMore: boolean
}

// 文件分类类型
export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'

// 分类规则类型
export type OrganizeRuleType = 'extension' | 'date' | 'size' | 'custom'

export interface OrganizeRule {
  type: OrganizeRuleType
  dateFormat?: 'year' | 'month' | 'day' // 日期分类格式
  pattern?: string // 自定义规则的正则表达式
}

// 文件大小分类范围
export interface SizeRange {
  id: string
  name: string // 分类名称，如 "小文件", "中等文件"
  minSize: number // 最小大小（字节）
  maxSize: number // 最大大小（字节）
}

// 整理配置选项
export interface OrganizeOptions {
  includeSubdirectories: boolean
  conflictAction: 'skip' | 'overwrite' | 'rename'
  previewOnly: boolean
}

// 整理配置
export interface OrganizeConfig {
  sourcePath: string
  rules: OrganizeRule
  options: OrganizeOptions
}

// 整理结果
export interface OrganizeResult {
  from: string
  to: string
  success: boolean
  error?: string
}

// 文件树节点
export interface TreeNode {
  key: string
  title: string
  path: string
  isLeaf: boolean
  children?: TreeNode[]
}

// 提取文件时使用的过滤条件
export interface ExtractFilter {
  extensions: string[]           // 需要提取的扩展名列表，空数组表示全部
  minSize?: number               // 最小文件大小（字节），可选
  maxSize?: number               // 最大文件大小（字节），可选
  category?: FileCategory | 'all'// 根据类型筛选（优先于 extensions），可选
}

// 预览结果项
export interface PreviewResultItem {
  from: string
  to: string
}

// 历史记录项
export interface HistoryItem {
  id: string // 唯一标识，使用路径
  path: string
  name: string // 显示名称
  timestamp: number // 访问时间戳
}

/** 文件整理操作历史（执行整理 / 提取 / 预览） */
export type OrganizeHistoryAction = 'organize' | 'extract' | 'preview'

export interface OrganizeHistoryItem {
  id: string
  timestamp: number
  action: OrganizeHistoryAction
  sourcePath: string
  /** 可读规则摘要，如「按扩展名」「按修改日期·按月」 */
  ruleLabel: string
  includeSubdirectories?: boolean
  conflictAction?: OrganizeOptions['conflictAction']
  successCount?: number
  failCount?: number
  totalCount?: number
}

// 相似照片检测相关类型

/** 检测档位：exact=仅完全重复, near=近重复(默认), scene=额外启用 CLIP 语义参考组 */
export type SimilarityDetectionMode = 'exact' | 'near' | 'scene'
/** 分组来源档位，决定该组是否允许批量删除 */
export type SimilarityTier = 'exact' | 'near' | 'scene'

export interface SimilarityScanConfig {
  scanPath: string // 扫描路径
  includeSubdirectories: boolean // 包含子文件夹
  minFileSize?: number // 最小文件大小（字节）
  maxFileSize?: number // 最大文件大小（字节）
  excludedFolders?: string[] // 排除的文件夹路径
  excludedExtensions?: string[] // 排除的文件扩展名
  similarityThreshold: number // 相似度阈值（0-100）
  /** 旧字段，保留兼容；新代码优先读 detectionMode */
  algorithm?: 'hash' | 'phash' | 'both'
  /** 新：三档检测范围 */
  detectionMode?: SimilarityDetectionMode
}

export interface ImageHash {
  filePath: string
  fileHash: string // MD5文件哈希
  perceptualHash?: string // 兼容旧字段（pHash hex，运行时不再依赖）
  width?: number
  height?: number
  size: number
  modifiedTime: number
  /** 清晰度（拉普拉斯方差），用于推荐保留 */
  sharpness?: number
  /** 解码失败原因；有值时该图不参与感知/语义比较 */
  decodeError?: string
}

/** 组内逐对判定依据 */
export interface SimilarityPairScore {
  a: string
  b: string
  score: number
  tier: SimilarityTier
  breakdown?: {
    pHash?: number
    dHash?: number
    color?: number
    aspect?: number
    semantic?: number
  }
}

export interface SimilarityGroup {
  id: string
  images: ImageHash[]
  similarity: number // 组内判定边的平均相似度
  tier: SimilarityTier
  /** false 表示仅供参考，禁止进入批量删除/移动 */
  safeToDelete: boolean
  recommendedKeep?: string // 推荐保留的文件路径
  pairScores: SimilarityPairScore[]
  reason: string
}

export interface SimilarityScanProgress {
  current: number
  total: number
  currentFile?: string
  status: 'scanning' | 'hashing' | 'comparing' | 'semantic' | 'completed' | 'error' | 'cancelled'
  groupsFound: number
  /** 比对阶段细粒度进度 0..100 */
  stagePercent?: number
  stageLabel?: string
}

export interface SimilarityScanResult {
  groups: SimilarityGroup[]
  totalImages: number
  totalGroups: number
  potentialSpaceSaved: number // 字节
  scanTime: number // 扫描耗时（毫秒）
  /** 诊断信息 */
  stats?: {
    pairsCompared: number
    decodeFailures: number
    exactGroups: number
    nearGroups: number
    sceneGroups: number
    semanticAvailable: boolean
    cancelled: boolean
    threshold: number
  }
}

/** 图片质量快速筛选：曝光/对比度阈值与构图启发式参数 */
export interface ImageQualityThresholds {
  /** 高光占比超过此值（0–1）则标记可能过曝 */
  highlightClipRatio: number
  /** 阴影占比超过此值（0–1）则标记可能欠曝 */
  shadowClipRatio: number
  /** 亮度标准差低于此值则标记低对比（发灰） */
  lowContrastStd: number
  /** 平均亮度高于此值（0–255）则辅助标记过曝 */
  overexposedMeanLuma: number
  /** 平均亮度低于此值（0–255）则辅助标记欠曝 */
  underexposedMeanLuma: number
  /** 中心宫格梯度能量占比超过此值则提示「主体过于居中」 */
  compositionCenterEnergyRatio: number
  /** 重心到最近三分点归一化距离大于此值则提示「偏离三分区」 */
  compositionCentroidOffThirdsMin: number
  /** 归一化重心距边缘小于此值则提示「主体贴近边缘」 */
  compositionNearEdge: number
  /** 拉普拉斯均值低于此值则提示可能模糊（0–255 尺度） */
  minSharpnessLapMean: number
  /** 局部噪点估计高于此值则提示噪点偏多（0–255 尺度） */
  maxNoiseLevel: number
  /** 通道偏离灰度均值的比例高于此值则提示色偏（0–1） */
  maxColorCastScore: number
}

export const DEFAULT_IMAGE_QUALITY_THRESHOLDS: ImageQualityThresholds = {
  highlightClipRatio: 0.06,
  shadowClipRatio: 0.06,
  lowContrastStd: 14,
  overexposedMeanLuma: 200,
  underexposedMeanLuma: 48,
  compositionCenterEnergyRatio: 0.52,
  compositionCentroidOffThirdsMin: 0.22,
  compositionNearEdge: 0.09,
  minSharpnessLapMean: 9,
  maxNoiseLevel: 16,
  maxColorCastScore: 0.14
}

export interface ImageQualityScanConfig {
  scanPath: string
  includeSubdirectories: boolean
  minFileSize?: number
  maxFileSize?: number
  excludedFolders?: string[]
  excludedExtensions?: string[]
  /** 分析时长边像素，默认 640 */
  analysisLongEdge?: number
  /** 并行分析数量，默认 3 */
  maxConcurrent?: number
  thresholds?: Partial<ImageQualityThresholds>
}

export type ImageQualityFlag =
  | 'overexposed'
  | 'underexposed'
  | 'lowContrast'
  | 'subjectVeryCentered'
  | 'subjectOffThirds'
  | 'subjectNearEdge'
  | 'blurry'
  | 'noisy'
  | 'colorCast'

export interface ImageQualityScores {
  meanLuma: number
  lumaStd: number
  highlightClipRatio: number
  shadowClipRatio: number
  gridEntropy: number
  centroidOffsetNorm: number
  centerCellEnergyRatio: number
  minThirdsDistance: number
  sharpnessLapMean: number
  noiseLevel: number
  colorCastScore: number
}

export interface ImageQualityItemResult {
  filePath: string
  ok: boolean
  error?: string
  width: number
  height: number
  flags: ImageQualityFlag[]
  compositionHints: string[]
  scores: ImageQualityScores
}

export interface ImageQualityScanProgress {
  current: number
  total: number
  currentFile?: string
  status: 'scanning' | 'analyzing' | 'completed' | 'error' | 'cancelled'
}

export interface ImageQualityScanResult {
  items: ImageQualityItemResult[]
  skipped: Array<{ path: string; reason: string }>
  totalImages: number
  scanTime: number
}

/** 批量复制/移动时的重名策略 */
export type FileConflictAction = 'skip' | 'overwrite' | 'rename'

export interface BatchFileOpResult {
  filePath: string
  success: boolean
  newPath?: string
  error?: string
}

export interface BatchRelocateEntry {
  from: string
  to: string
}

/** 快速筛选：用户整理意图档位（非 EXIF 星级） */
export type QuickFilterTier = 'high' | 'medium' | 'low'

/** 图片内容分类（9 大类：真实 CLIP 文本嵌入零样本分类） */
export type ImageContentCategory =
  | 'person'
  | 'animal'
  | 'landscape'
  | 'urban'
  | 'indoor'
  | 'food'
  | 'vehicle'
  | 'document'
  | 'other'

export const IMAGE_CATEGORY_ORDER: readonly ImageContentCategory[] = [
  'person',
  'animal',
  'landscape',
  'urban',
  'indoor',
  'food',
  'vehicle',
  'document',
  'other'
] as const

export const IMAGE_CATEGORY_LABELS: Record<ImageContentCategory, string> = {
  person: '人物',
  animal: '动物',
  landscape: '自然风景',
  urban: '城市建筑',
  indoor: '室内',
  food: '食物',
  vehicle: '交通工具',
  document: '截图',
  other: '其他'
}

export const IMAGE_CATEGORY_COLORS: Record<ImageContentCategory, string> = {
  person: 'purple',
  animal: 'green',
  landscape: 'cyan',
  urban: 'geekblue',
  indoor: 'lime',
  food: 'red',
  vehicle: 'blue',
  document: 'gold',
  other: 'default'
}

/** 将旧版细分类结果映射到 9 大类（用于 localStorage 迁移） */
export function migrateLegacyImageCategory(raw: string): ImageContentCategory {
  const table: Record<string, ImageContentCategory> = {
    person: 'person',
    portrait: 'person',
    selfie: 'person',
    dog: 'animal',
    cat: 'animal',
    bird: 'animal',
    wild_animal: 'animal',
    marine_animal: 'animal',
    insect: 'animal',
    pet: 'animal',
    landscape: 'landscape',
    mountain: 'landscape',
    beach: 'landscape',
    sunset: 'landscape',
    forest: 'landscape',
    cityscape: 'urban',
    night_scene: 'urban',
    building: 'urban',
    landmark: 'urban',
    street: 'urban',
    interior: 'indoor',
    food: 'food',
    drink: 'food',
    dessert: 'food',
    vehicle: 'vehicle',
    aircraft: 'vehicle',
    ship: 'vehicle',
    art: 'document',
    technology: 'document',
    document: 'document',
    other: 'other'
  }
  if (table[raw]) return table[raw]
  if (IMAGE_CATEGORY_ORDER.includes(raw as ImageContentCategory)) return raw as ImageContentCategory
  return 'other'
}

export type ClassificationStatus = 'ok' | 'uncertain' | 'failed'

export interface ImageClassificationResult {
  filePath: string
  category: ImageContentCategory
  confidence: number // 置信度 0-1
  /** 分类决策状态：成功 / 低置信不确定 / 推理失败 */
  classificationStatus?: ClassificationStatus
  /** 仅 classificationStatus 为 failed 时提供 */
  failureReason?: string
  /** 曝光/对比度/构图启发式档位，与快速筛选一致；批量或单张分类时由主进程写入 */
  quality?: QuickFilterTier
  topPredictions?: Array<{
    category: ImageContentCategory
    confidence: number
  }>
  /** 用户手动纠正过分类；UI 会标记，复核筛选时不再视为待确认 */
  manualOverride?: boolean
}

export interface ImageClassificationConfig {
  imagePaths: string[]
  batchSize?: number // 批处理大小，默认 10
  includeSubdirectories?: boolean
  /** @deprecated 使用 presetId */
  modelId?: string
  /** 精准度预设：accuracy_fast | accuracy_max */
  presetId?: ClassificationPresetId
}

export type ClassificationPresetId =
  | 'accuracy_fast'
  | 'accuracy_max'
  /** @deprecated 映射到 accuracy_fast */
  | 'accuracy_light'
  /** @deprecated 映射到 accuracy_max */
  | 'accuracy_balanced'

export const CLASSIFICATION_PRESET_STORAGE_KEY = 'classification_selected_preset'

export const DEFAULT_CLASSIFICATION_PRESET_ID: ClassificationPresetId = 'accuracy_max'

const PRESET_ID_ALIASES: Record<string, ClassificationPresetId> = {
  accuracy_light: 'accuracy_fast',
  accuracy_balanced: 'accuracy_max'
}

/** 将 localStorage / 旧版预设 ID 规范为当前预设 */
export function normalizeClassificationPresetId(raw?: string | null): ClassificationPresetId {
  if (!raw) return DEFAULT_CLASSIFICATION_PRESET_ID
  if (PRESET_ID_ALIASES[raw]) return PRESET_ID_ALIASES[raw]
  if (raw === 'accuracy_fast' || raw === 'accuracy_max') return raw
  return DEFAULT_CLASSIFICATION_PRESET_ID
}

export interface ClassificationPresetInfo {
  id: ClassificationPresetId
  name: string
  description: string
  clipModelId: string
  imagenetModelId: string | null
  promptsFile: string
  ttaCropCount: number
  estimatedSpeedFactor: number
  totalSizeMB: number
}

/** 前端展示用（IPC 不可用时兜底，与主进程预设一致） */
export const CLASSIFICATION_PRESET_UI_OPTIONS: ClassificationPresetInfo[] = [
  {
    id: 'accuracy_fast',
    name: '快速预览',
    description: 'CLIP B/32 单裁剪，速度快；评估集 Top-1 88.2%',
    clipModelId: 'clip_vit_b32_quant',
    imagenetModelId: null,
    promptsFile: 'clip-prompts.json',
    ttaCropCount: 1,
    estimatedSpeedFactor: 1,
    totalSizeMB: 90
  },
  {
    id: 'accuracy_max',
    name: '最高精准',
    description: 'CLIP L/14 + 5 裁剪 TTA；评估集 Top-1 91.7%，推荐默认',
    clipModelId: 'clip_vit_l14_quant',
    imagenetModelId: null,
    promptsFile: 'clip-prompts-l14.json',
    ttaCropCount: 5,
    estimatedSpeedFactor: 5,
    totalSizeMB: 300
  }
]

/** 分类结果在 UI 上的展示文案 */
export function getClassificationDisplayLabel(result: Pick<
  ImageClassificationResult,
  'category' | 'classificationStatus'
>): string {
  if (result.classificationStatus === 'failed') return '分类失败'
  const base = IMAGE_CATEGORY_LABELS[result.category] || result.category
  if (result.classificationStatus === 'uncertain') return `${base}（不确定）`
  return base
}

export interface ImageClassificationProgress {
  current: number
  total: number
  currentFile?: string
  status: 'loading' | 'classifying' | 'completed' | 'error'
  results?: ImageClassificationResult[]
  latestResult?: ImageClassificationResult
}

export interface ImageClassificationBatchResult {
  results: ImageClassificationResult[]
  totalImages: number
  successCount: number
  errorCount: number
  classificationTime: number // 分类耗时（毫秒）
}

export interface ImageEditSettings {
  brightness?: number // 百分比，100为原始
  contrast?: number
  saturation?: number
  hue?: number
  exposure?: number
  rotation?: number // 角度
  flipHorizontal?: boolean
  flipVertical?: boolean
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
  // 滤镜
  grayscale?: boolean
  vintage?: number // 0-100
  blur?: number // 0-20
  sharpen?: number // 0-100
  // 高级调整
  shadows?: number // -100 到 100
  highlights?: number // -100 到 100
  clarity?: number // -100 到 100
  tint?: number // -100 到 100（绿/品红）
  temperature?: number // -100 到 100（冷/暖）
  gamma?: number // 50-200，100 为原始
  vignette?: number // 0-100 暗角
  fade?: number // 0-100 褪色
  grain?: number // 0-100 颗粒
  denoise?: number // 0-100 降噪
  /** 色阶：黑点/白点 0–255，中间调 gamma 50–200（100=原始） */
  levels?: { black: number; white: number; gamma: number }
  /** 色调曲线：主曲线与 R/G/B 分通道（x/y 归一化 0–1） */
  toneCurve?: {
    master?: Array<{ x: number; y: number }>
    red?: Array<{ x: number; y: number }>
    green?: Array<{ x: number; y: number }>
    blue?: Array<{ x: number; y: number }>
  }
  /** 去雾 0–100 */
  dehaze?: number
  /** 鲜明度 -100–100 */
  vibrance?: number
  /** HSL 分色相 8 色微调（h/s/l 各 -100–100） */
  hslHueAdjust?: Partial<Record<HslHueRegionId, HslHueRegionAdjust>>
}

/** HSL 分色相 8 色区域 */
export type HslHueRegionId =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'magenta'

export interface HslHueRegionAdjust {
  h?: number
  s?: number
  l?: number
}

export interface FormatConversionOptions {
  // supported formats including common image types and PDF
  targetFormat: string // e.g. 'jpeg','png','webp','bmp','tiff','pdf'
  quality?: number // 1-100 (ignored for PDF)
  /** 最长边上限（像素），与 scalePercent 二选一优先 maxEdge */
  maxEdge?: number
  /** 相对原图缩放 1–100% */
  scalePercent?: number
  /** 导出前应用的编辑参数（编辑器内导出） */
  editSettings?: ImageEditSettings
  /** 导出时叠加水印 */
  watermark?: WatermarkOptions
  /** true：覆盖原图；若目标扩展名不同则写入新扩展名后删除原文件 */
  overwrite?: boolean
}

/** 编辑器导出预览（含编辑+格式+质量） */
export interface ExportPreviewResult {
  dataUrl: string
  byteSize: number
  width: number
  height: number
}

export interface PresetGroup {
  id: string
  name: string
  isBuiltIn: boolean // 是否为内置分组，不可编辑
}

export interface ImagePreset {
  id: string
  name: string
  settings: ImageEditSettings
  groupId?: string // 所属分组ID
}

export interface CompressionOptions {
  qualityPercentage: number // 1-100
}

export interface BatchOperationResult {
  filePath: string
  success: boolean
  error?: string
  newPath?: string // when operation succeeded but original file couldn't be overwritten, result saved to this path
}

// ==================== 实用工具类型定义 ====================

export interface BatchRenameOptions {
  mode: 'sequence' | 'date' | 'replace' | 'prefix' | 'suffix'
  sequenceStart?: number
  sequencePadding?: number
  dateFormat?: string
  findText?: string
  replaceText?: string
  prefix?: string
  suffix?: string
  caseSensitive?: boolean
  outputPath?: string
  conflictAction?: 'skip' | 'overwrite' | 'rename'
}

export interface RenameResult {
  originalPath: string
  newPath: string
  success: boolean
  error?: string
}

export interface WatermarkOptions {
  type: 'text' | 'image'
  text?: {
    content: string
    fontSize: number
    fontFamily: string
    color: string
    opacity: number
  }
  image?: {
    path: string
    scale: number
    opacity: number
  }
  position: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  margin: number
  tile?: boolean
  /**
   * optional directory to write watermarked files. if omitted, originals' dirs are used
   */
  outputPath?: string
}

export interface StitchOptions {
  mode: 'horizontal' | 'vertical' | 'grid'
  rows?: number
  cols?: number
  gap: number
  backgroundColor: string
  align: 'start' | 'center' | 'end'
  outputFormat: 'jpeg' | 'png' | 'webp'
  quality: number
}

export interface GifFrame {
  imagePath: string
  delay: number
}

export interface GifOptions {
  width?: number
  height?: number
  delay: number
  loop: number
  quality: number
  outputPath: string
}

export interface PdfOptions {
  pageSize: 'a4' | 'a3' | 'letter' | 'original'
  orientation: 'auto' | 'portrait' | 'landscape'
  margin: number
  imagesPerPage: number | 'auto'
  outputPath: string
}

export interface ThumbnailOptions {
  width: number
  height: number
  fit: 'cover' | 'contain' | 'fill'
  format: 'jpeg' | 'png' | 'webp'
  quality: number
  outputDir: 'same' | 'custom'
  customOutputDir?: string
  naming: 'prefix' | 'suffix' | 'custom'
  prefix?: string
  suffix?: string
  customName?: string
}

export interface ThumbnailResult {
  originalPath: string
  thumbnailPath: string
  success: boolean
  error?: string
}

export interface EnhanceOptions {
  mode: 'auto' | 'manual'
  auto?: {
    exposure: boolean
    denoise: boolean
    sharpen: boolean
  }
  manual?: {
    brightness: number
    contrast: number
    saturation: number
    sharpness: number
    denoise: number
  }
  scale?: 1 | 2 | 4
  outputPath?: string
}

/** 图片查看器：人脸/主体对焦点（相对坐标 0–1） */
export interface PhotoFocusPoint {
  x: number
  y: number
  weight?: number
}

export interface PhotoFocusPointsResult {
  points: PhotoFocusPoint[]
}

export type FocusAdjustMode = 'subjectRecover' | 'regionSharpen'

export interface FocusAdjustOptions {
  mode: FocusAdjustMode
  focusX: number
  focusY: number
  radius: number
  sharpenStrength: number
  backgroundBlur: number
  feather: number
  outputPath?: string
}
