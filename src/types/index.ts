// 文件信息类型
export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedTime: number
  createdTime: number
}

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