import type { FileInfo } from '../../types'

export interface FileListProps {
  className?: string
}

export interface PreviewData {
  thumbnail: string
  full: string
}

export interface ImagePreviewState {
  previews: Map<string, PreviewData>
  visibleImages: Set<string>
  loadingImages: Set<string>
  progress: Map<string, number>
}

export interface FileListState {
  selectedRowKeys: string[]
  selectedRows: FileInfo[]
  viewMode: 'list' | 'grid'
  currentPage: number
  pageSize: number
  selectedImageCategory: string
  gridColumns: number
}

export const CATEGORY_COLORS: Record<string, string> = {
  animal: '#52c41a',
  vehicle: '#1890ff',
  person: '#eb2f96',
  landscape: '#13c2c2',
  architecture: '#fa8c16',
  food: '#f5222d',
  other: '#8c8c8c'
}

export const CATEGORY_LABELS: Record<string, string> = {
  animal: '动物',
  vehicle: '车辆',
  person: '人物',
  landscape: '风景',
  architecture: '建筑',
  food: '食物',
  other: '其他'
}

export const MAX_IMAGE_SIZE = 50 * 1024 * 1024

export const PAGE_SIZE_OPTIONS = ['15', '30', '75', '150', '300']
