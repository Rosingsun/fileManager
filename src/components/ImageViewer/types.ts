/**
 * 图片查看器相关类型定义
 */

import type { ImageClassificationResult } from '../../types'

export interface Image {
  id: string
  url: string // 图片URL
  thumbnailUrl?: string // 缩略图URL
  filename: string
  width: number
  height: number
  size: number // 字节
  format: string
  createdAt: string
  modifiedAt: string
  description?: string
  tags?: string[]
  classification?: ImageClassificationResult // 图片分类结果
  exif?: ExifData
}

export interface ExifData {
  make?: string // 相机品牌
  model?: string // 相机型号
  exposureTime?: string // 曝光时间
  fNumber?: number // 光圈值
  iso?: number // ISO
  focalLength?: number // 焦距
  lensModel?: string // 镜头型号
  dateTimeOriginal?: string // 拍摄时间
  gpsLatitude?: number // 纬度
  gpsLongitude?: number // 经度
  // 其他EXIF字段
  [key: string]: any
}

export interface ImageUpdates {
  description?: string
  tags?: string[]
  [key: string]: any
}

export interface ImageViewerProps {
  // 必需参数
  images: Image[] // 图片列表
  currentIndex: number // 当前显示的图片索引
  // 可选参数
  onIndexChange?: (index: number) => void // 图片切换回调
  onClose?: () => void // 关闭查看器
  onImageEdit?: (imageId: string, updates: ImageUpdates) => void // 图片编辑回调
  onTagsUpdate?: (imageId: string, tags: string[]) => void // 标签更新回调
  onDescriptionUpdate?: (imageId: string, description: string) => void // 描述更新回调
  onImageDelete?: (imageId: string) => void // 删除图片回调
  onImageRotate?: (imageId: string, rotation: number) => void // 旋转图片回调
  onImageFlip?: (imageId: string, direction: 'horizontal' | 'vertical') => void // 翻转图片回调
}

export type ViewMode = 'fit' | 'actual' | 'free'

export interface ColorInfo {
  hex: string
  rgb: { r: number; g: number; b: number }
  percentage: number // 在图片中的占比
}

