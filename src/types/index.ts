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

// 图片内容分类相关类型 - 升级版（25个细分类）
export type ImageContentCategory =
  // 人物类
  | 'person'           // 人物
  | 'portrait'         // 人像
  | 'selfie'           // 自拍
  // 动物类
  | 'dog'              // 狗
  | 'cat'              // 猫
  | 'bird'             // 鸟类
  | 'wild_animal'      // 野生动物
  | 'marine_animal'    // 海洋生物
  | 'insect'           // 昆虫
  | 'pet'              // 宠物
  // 风景类
  | 'landscape'        // 风景
  | 'mountain'         // 山脉
  | 'beach'            // 海滩
  | 'sunset'           // 日落
  | 'forest'           // 森林
  | 'cityscape'        // 城市风光
  | 'night_scene'      // 夜景
  // 建筑类
  | 'building'         // 建筑
  | 'landmark'         // 地标
  | 'interior'         // 室内
  | 'street'           // 街道
  // 食物类
  | 'food'             // 食物
  | 'drink'            // 饮品
  | 'dessert'          // 甜点
  // 交通类
  | 'vehicle'          // 车辆
  | 'aircraft'         // 飞机
  | 'ship'             // 船舶
  // 其他
  | 'art'              // 艺术
  | 'technology'       // 科技产品
  | 'document'         // 文档图片
  | 'other'            // 其他

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
}// ͼƬ�༭�������
export interface ImageEditSettings {
  brightness?: number // �ٷֱȣ�100Ϊԭʼ
  contrast?: number
  saturation?: number
  hue?: number
  exposure?: number
  rotation?: number // �Ƕ�
  flipHorizontal?: boolean
  flipVertical?: boolean
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface ImagePreset {
  id: string
  name: string
  settings: ImageEditSettings
}

export interface FormatConversionOptions {
  targetFormat: string // e.g. 'jpeg','png','webp','bmp'
  quality?: number // 1-100
}

export interface CompressionOptions {
  qualityPercentage: number // 1-100
}

export interface BatchOperationResult {
  filePath: string
  success: boolean
  error?: string
}
