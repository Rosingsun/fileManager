import type { FileInfo, ImageContentCategory } from '../../types'
import { IMAGE_CATEGORY_COLORS, IMAGE_CATEGORY_LABELS } from '../../types'

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

/** 与 Ant Design Tag `color` 一致，供列表「分类」列使用 */
export const CATEGORY_COLORS: Record<ImageContentCategory, string> = IMAGE_CATEGORY_COLORS

export const CATEGORY_LABELS: Record<ImageContentCategory, string> = IMAGE_CATEGORY_LABELS

export const MAX_IMAGE_SIZE = 50 * 1024 * 1024

export const PAGE_SIZE_OPTIONS = ['15', '30', '75', '150', '300']
