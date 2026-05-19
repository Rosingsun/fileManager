/**
 * 图片 / RAW / Live Photo 扩展名（主进程，与 src/utils/mediaExtensions 保持一致）
 */

export const STANDARD_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'svg',
  'webp',
  'heic',
  'heif',
  'tiff',
  'tif'
] as const

export const RAW_IMAGE_EXTENSIONS = [
  'cr2',
  'cr3',
  'nef',
  'nrw',
  'arw',
  'srf',
  'sr2',
  'dng',
  'raf',
  'orf',
  'rw2',
  'pef',
  'ptx',
  'srw',
  '3fr',
  'mrw',
  'raw',
  'x3f'
] as const

export const LIVE_STILL_EXTENSIONS = ['heic', 'heif', 'jpg', 'jpeg'] as const

export const LIVE_VIDEO_EXTENSIONS = ['mov'] as const

export const PREVIEWABLE_IMAGE_EXTENSIONS = [
  ...STANDARD_IMAGE_EXTENSIONS,
  ...RAW_IMAGE_EXTENSIONS
] as const

export const IMAGE_EXTENSIONS = [...PREVIEWABLE_IMAGE_EXTENSIONS] as string[]

export function normalizeExtension(ext: string): string {
  return ext.replace(/^\./, '').toLowerCase()
}

export function getExtensionFromPath(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() || filePath
  return normalizeExtension(base.split('.').pop() || '')
}

export function isRawImagePath(filePath: string): boolean {
  return (RAW_IMAGE_EXTENSIONS as readonly string[]).includes(getExtensionFromPath(filePath))
}

export function isLiveStillPath(filePath: string): boolean {
  return (LIVE_STILL_EXTENSIONS as readonly string[]).includes(getExtensionFromPath(filePath))
}

export function isLiveVideoPath(filePath: string): boolean {
  return (LIVE_VIDEO_EXTENSIONS as readonly string[]).includes(getExtensionFromPath(filePath))
}

export function isPreviewableImagePath(filePath: string): boolean {
  return (PREVIEWABLE_IMAGE_EXTENSIONS as readonly string[]).includes(getExtensionFromPath(filePath))
}

export function getFileBaseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}
