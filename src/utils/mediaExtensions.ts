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

/**
 * 生成本地媒体 URL（media-local:///…，路径在 pathname，避免 Windows 盘符被解析为 host）
 */
export function toMediaLocalUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/')
  return `media-local:///${encodeURIComponent(normalized)}`
}

export const PREVIEWABLE_VIDEO_EXTENSIONS = [
  'mp4',
  'avi',
  'mov',
  'wmv',
  'flv',
  'mkv',
  'webm',
  'm4v',
  '3gp',
  'rmvb'
] as const

export const PREVIEWABLE_AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'flac',
  'aac',
  'ogg',
  'wma',
  'm4a',
  'ape',
  'aiff'
] as const

export const PREVIEWABLE_PDF_EXTENSIONS = ['pdf'] as const

export type MediaPreviewKind = 'image' | 'video' | 'audio' | 'pdf'

export function isPreviewableVideo(ext: string): boolean {
  return (PREVIEWABLE_VIDEO_EXTENSIONS as readonly string[]).includes(normalizeExtension(ext))
}

export function isPreviewableAudio(ext: string): boolean {
  return (PREVIEWABLE_AUDIO_EXTENSIONS as readonly string[]).includes(normalizeExtension(ext))
}

export function isPreviewablePdf(ext: string): boolean {
  return (PREVIEWABLE_PDF_EXTENSIONS as readonly string[]).includes(normalizeExtension(ext))
}

export function getMediaPreviewKind(ext: string): MediaPreviewKind | null {
  const normalized = normalizeExtension(ext)
  if (isPreviewableImage(normalized)) return 'image'
  if (isPreviewableVideo(normalized)) return 'video'
  if (isPreviewableAudio(normalized)) return 'audio'
  if (isPreviewablePdf(normalized)) return 'pdf'
  return null
}

export function isPreviewableMedia(ext: string): boolean {
  return getMediaPreviewKind(ext) !== null
}

export function isPreviewableImageFile(
  fileName: string,
  siblingFileNames: string[]
): boolean {
  const ext = normalizeExtension(fileName.split('.').pop() || '')
  if (!isPreviewableImage(ext)) return false
  if (shouldHideAsLiveCompanion(fileName, siblingFileNames)) return false
  return true
}
