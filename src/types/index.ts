// 文件信息类型
export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedTime: number
  createdTime: number
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

// 相似照片检测相关类型
export interface SimilarityScanConfig {
  scanPath: string // 扫描路径
  includeSubdirectories: boolean // 包含子文件夹
  minFileSize?: number // 最小文件大小（字节）
  maxFileSize?: number // 最大文件大小（字节）
  excludedFolders?: string[] // 排除的文件夹路径
  excludedExtensions?: string[] // 排除的文件扩展名
  similarityThreshold: number // 相似度阈值（0-100）
  algorithm: 'hash' | 'phash' | 'both' // 检测算法
}

export interface ImageHash {
  filePath: string
  fileHash: string // MD5文件哈希
  perceptualHash?: string // 感知哈希（pHash）
  width?: number
  height?: number
  size: number
  modifiedTime: number
}

export interface SimilarityGroup {
  id: string
  images: ImageHash[]
  similarity: number // 平均相似度
  recommendedKeep?: string // 推荐保留的文件路径
}

export interface SimilarityScanProgress {
  current: number
  total: number
  currentFile?: string
  status: 'scanning' | 'hashing' | 'comparing' | 'completed' | 'error'
  groupsFound: number
}

export interface SimilarityScanResult {
  groups: SimilarityGroup[]
  totalImages: number
  totalGroups: number
  potentialSpaceSaved: number // 字节
  scanTime: number // 扫描耗时（毫秒）
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
}

export const DEFAULT_IMAGE_QUALITY_THRESHOLDS: ImageQualityThresholds = {
  highlightClipRatio: 0.06,
  shadowClipRatio: 0.06,
  lowContrastStd: 14,
  overexposedMeanLuma: 200,
  underexposedMeanLuma: 48,
  compositionCenterEnergyRatio: 0.52,
  compositionCentroidOffThirdsMin: 0.22,
  compositionNearEdge: 0.09
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

export interface ImageQualityScores {
  meanLuma: number
  lumaStd: number
  highlightClipRatio: number
  shadowClipRatio: number
  gridEntropy: number
  centroidOffsetNorm: number
  centerCellEnergyRatio: number
  minThirdsDistance: number
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

/** 图片内容分类（9 大类：CLIP 零样本 + ImageNet 聚合） */
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
  document: '文档界面',
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

export interface ImageClassificationResult {
  filePath: string
  category: ImageContentCategory
  confidence: number // 置信度 0-1
  topPredictions?: Array<{
    category: ImageContentCategory
    confidence: number
  }>
}

export interface ImageClassificationConfig {
  imagePaths: string[]
  batchSize?: number // 批处理大小，默认 10
  includeSubdirectories?: boolean
  modelId?: string // 使用的模型 ID
}

export interface ImageClassificationProgress {
  current: number
  total: number
  currentFile?: string
  status: 'loading' | 'classifying' | 'completed' | 'error'
  results?: ImageClassificationResult[]
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
  tint?: number // -100 到 100
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

export interface FormatConversionOptions {
  // supported formats including common image types and PDF
  targetFormat: string // e.g. 'jpeg','png','webp','bmp','tiff','pdf'
  quality?: number // 1-100 (ignored for PDF)
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
