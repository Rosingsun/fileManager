/**
 * 图片 / RAW / Live Photo 扩展名与判断工具（渲染进程）
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

export type PreviewableImageExtension = (typeof PREVIEWABLE_IMAGE_EXTENSIONS)[number]

export function normalizeExtension(ext: string): string {
  return ext.replace(/^\./, '').toLowerCase()
}

export function isRawImage(ext: string): boolean {
  return (RAW_IMAGE_EXTENSIONS as readonly string[]).includes(normalizeExtension(ext))
}

export function isLiveStill(ext: string): boolean {
  return (LIVE_STILL_EXTENSIONS as readonly string[]).includes(normalizeExtension(ext))
}

export function isLiveVideo(ext: string): boolean {
  return (LIVE_VIDEO_EXTENSIONS as readonly string[]).includes(normalizeExtension(ext))
}

export function isPreviewableImage(ext: string): boolean {
  return (PREVIEWABLE_IMAGE_EXTENSIONS as readonly string[]).includes(normalizeExtension(ext))
}

/** 文件名主名（不含扩展名），用于 Live 静帧与 MOV 配对 */
export function getFileBaseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

/**
 * 若同目录存在同名 Live 静帧（HEIC/JPG），则隐藏伴生 MOV，避免列表重复
 */
/** 同目录存在同名 MOV 时，静帧可能为 Apple Live Photo */
export function isLikelyLivePhoto(fileName: string, siblingFileNames: string[]): boolean {
  const ext = normalizeExtension(fileName.split('.').pop() || '')
  if (!isLiveStill(ext)) return false
  const base = getFileBaseName(fileName).toLowerCase()
  return siblingFileNames.some((name) => {
    const otherExt = normalizeExtension(name.split('.').pop() || '')
    if (!isLiveVideo(otherExt)) return false
    return getFileBaseName(name).toLowerCase() === base
  })
}

export function shouldHideAsLiveCompanion(
  fileName: string,
  siblingFileNames: string[]
): boolean {
  const ext = normalizeExtension(fileName.split('.').pop() || '')
  if (!isLiveVideo(ext)) return false
  const base = getFileBaseName(fileName).toLowerCase()
  return siblingFileNames.some((name) => {
    if (name === fileName) return false
    const otherExt = normalizeExtension(name.split('.').pop() || '')
    if (!isLiveStill(otherExt)) return false
    return getFileBaseName(name).toLowerCase() === base
  })
}

export function toMediaLocalUrl(absolutePath: string): string {
  return `media-local://${encodeURIComponent(absolutePath.replace(/\\/g, '/'))}`
}
