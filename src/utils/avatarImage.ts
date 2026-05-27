import { cosPresignGet, cosUploadImageViaApi } from './cosClient'

export const AVATAR_SELECT_MAX_BYTES = 10 * 1024 * 1024
export const AVATAR_UPLOAD_MAX_BYTES = 1024 * 1024
export const AVATAR_COS_PARENT_PREFIX = 'avatars/'
export const AVATAR_COS_REF_PREFIX = 'cos:'

const AVATAR_ACCEPT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const AVATAR_EXT_RE = /\.(jpe?g|png|webp|gif)$/i

export function isCosAvatarRef(ref: string | null | undefined): ref is string {
  return typeof ref === 'string' && ref.startsWith(AVATAR_COS_REF_PREFIX)
}

export function toCosAvatarRef(key: string): string {
  return `${AVATAR_COS_REF_PREFIX}${key}`
}

export function parseCosAvatarKey(ref: string): string | null {
  if (!isCosAvatarRef(ref)) return null
  const key = ref.slice(AVATAR_COS_REF_PREFIX.length).trim()
  return key || null
}

export function isAllowedAvatarFile(file: File): boolean {
  if (AVATAR_ACCEPT_MIME.has(file.type)) return true
  return AVATAR_EXT_RE.test(file.name)
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('无法读取图片'))
    img.src = src
  })
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await loadImageElement(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片编码失败'))),
      type,
      quality
    )
  })
}

async function encodeCanvasUnderSize(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  width: number,
  height: number,
  maxBytes: number
): Promise<Blob> {
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.drawImage(img, 0, 0, width, height)

  const mime = 'image/jpeg'
  let quality = 0.88
  let blob = await canvasToBlob(canvas, mime, quality)
  while (blob.size > maxBytes && quality > 0.32) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, mime, quality)
  }
  return blob
}

/** 将用户选择的图片压缩到 1MB 以内（上传用） */
export async function compressImageFileForAvatar(file: File): Promise<File> {
  if (file.size > AVATAR_SELECT_MAX_BYTES) {
    throw new Error('图片不能超过 10MB')
  }
  if (!isAllowedAvatarFile(file)) {
    throw new Error('请选择 JPG、PNG、WebP 或 GIF 图片')
  }

  const img = await loadImageFromFile(file)
  const maxDim = 1024
  let w = img.naturalWidth
  let h = img.naturalHeight
  if (!w || !h) throw new Error('图片尺寸无效')

  if (Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h)
    w = Math.max(1, Math.round(w * scale))
    h = Math.max(1, Math.round(h * scale))
  }

  const canvas = document.createElement('canvas')
  let blob = await encodeCanvasUnderSize(canvas, img, w, h, AVATAR_UPLOAD_MAX_BYTES)

  let dimScale = 1
  while (blob.size > AVATAR_UPLOAD_MAX_BYTES && dimScale > 0.3) {
    dimScale *= 0.82
    const nw = Math.max(96, Math.round(w * dimScale))
    const nh = Math.max(96, Math.round(h * dimScale))
    blob = await encodeCanvasUnderSize(canvas, img, nw, nh, AVATAR_UPLOAD_MAX_BYTES)
  }

  if (blob.size > AVATAR_UPLOAD_MAX_BYTES) {
    throw new Error('无法将图片压缩到 1MB 以内，请换一张更小的图片')
  }

  const stem = file.name.replace(/\.[^.]+$/, '') || 'avatar'
  return new File([blob], `${stem}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

/** 将远程图片压缩为适合头像展示的较小 Blob（读取展示用） */
export async function compressImageUrlForAvatarDisplay(
  sourceUrl: string,
  maxPx = 160
): Promise<Blob> {
  const img = await loadImageElement(sourceUrl)
  let w = img.naturalWidth
  let h = img.naturalHeight
  if (!w || !h) throw new Error('图片尺寸无效')

  if (Math.max(w, h) > maxPx) {
    const scale = maxPx / Math.max(w, h)
    w = Math.max(1, Math.round(w * scale))
    h = Math.max(1, Math.round(h * scale))
  }

  const canvas = document.createElement('canvas')
  const blob = await encodeCanvasUnderSize(canvas, img, w, h, 256 * 1024)
  return blob
}

export async function uploadAvatarToCos(file: File): Promise<string> {
  const compressed = await compressImageFileForAvatar(file)
  const { key } = await cosUploadImageViaApi(compressed, { parentPrefix: AVATAR_COS_PARENT_PREFIX })
  return toCosAvatarRef(key)
}

export async function resolveAvatarSourceUrl(avatarUrl: string | null | undefined): Promise<string | undefined> {
  if (!avatarUrl?.trim()) return undefined
  const trimmed = avatarUrl.trim()
  if (isCosAvatarRef(trimmed)) {
    const key = parseCosAvatarKey(trimmed)
    if (!key) return undefined
    const { previewUrl } = await cosPresignGet({ key })
    return previewUrl
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return undefined
}

const displayUrlCache = new Map<string, { url: string; expiresAt: number }>()
const DISPLAY_CACHE_TTL_MS = 5 * 60 * 1000

export async function resolveAvatarDisplayUrl(avatarUrl: string | null | undefined): Promise<string | undefined> {
  if (!avatarUrl?.trim()) return undefined
  const cacheKey = avatarUrl.trim()
  const cached = displayUrlCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const source = await resolveAvatarSourceUrl(avatarUrl)
  if (!source) return undefined

  try {
    const blob = await compressImageUrlForAvatarDisplay(source)
    const displayUrl = URL.createObjectURL(blob)
    const prev = displayUrlCache.get(cacheKey)
    if (prev) revokeAvatarDisplayUrl(prev.url)
    displayUrlCache.set(cacheKey, { url: displayUrl, expiresAt: Date.now() + DISPLAY_CACHE_TTL_MS })
    return displayUrl
  } catch {
    return source
  }
}

export function revokeAvatarDisplayUrl(url: string | undefined): void {
  if (!url?.startsWith('blob:')) return
  URL.revokeObjectURL(url)
  for (const [key, entry] of displayUrlCache) {
    if (entry.url === url) {
      displayUrlCache.delete(key)
      break
    }
  }
}
