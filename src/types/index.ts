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

