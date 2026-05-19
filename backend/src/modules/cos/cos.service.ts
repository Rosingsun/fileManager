import { randomUUID } from 'crypto'
import COS from 'cos-nodejs-sdk-v5'
import { getPool } from '../../db/pool.js'
import { writeAppLog } from '../../logger/appLogger.js'
import { AppError } from '../../utils/AppError.js'
import {
  getCosConfig,
  isCosConfigured,
  maybeRefreshCosConfig,
  registerCosClientInvalidator,
  type CosRuntimeConfig,
} from '../parameters/cosConfig.service.js'

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

type CosInstance = InstanceType<typeof COS>

let cosClient: CosInstance | null = null

export { isCosConfigured }

registerCosClientInvalidator(() => {
  cosClient = null
})

async function prepareCos(): Promise<CosRuntimeConfig> {
  await maybeRefreshCosConfig(getPool())
  if (!isCosConfigured()) {
    throw new AppError(
      503,
      'COS_NOT_CONFIGURED',
      '未配置腾讯云 COS，请在 app_parameters 或管理端配置'
    )
  }
  return getCosConfig()
}

async function getCos(): Promise<CosInstance> {
  const cfg = await prepareCos()
  if (!cosClient) {
    cosClient = new COS({
      SecretId: cfg.secretId,
      SecretKey: cfg.secretKey,
    })
  }
  return cosClient
}

function userRoot(userId: string): string {
  return `${getCosConfig().keyPrefix}users/${userId}/`
}

function normalizeRelativeDir(input: string): string {
  const s = (input ?? '').trim().replace(/^\/+/, '')
  if (!s) return ''
  const raw = s.split('/').filter((p) => p.length > 0)
  if (raw.some((p) => p === '..')) {
    throw new AppError(400, 'BAD_PREFIX', '路径不合法')
  }
  const parts = raw.filter((p) => p !== '.')
  return parts.length ? `${parts.join('/')}/` : ''
}

function assertFullKeyUnderUser(userId: string, key: string): void {
  const root = userRoot(userId)
  const normalized = key.trim().replace(/^\/+/, '')
  if (!normalized.startsWith(root)) {
    throw new AppError(403, 'FORBIDDEN', '无权访问该对象路径')
  }
  if (normalized.includes('/../') || normalized.endsWith('/..') || normalized.startsWith('../')) {
    throw new AppError(403, 'FORBIDDEN', '无权访问该对象路径')
  }
}

/** 校验头像对象 Key：须在用户根下且位于 avatars 子目录 */
export function assertUserAvatarObjectKey(userId: string, key: string): string {
  assertFullKeyUnderUser(userId, key)
  const normalized = key.trim().replace(/^\/+/, '')
  if (!normalized.includes('/avatars/')) {
    throw new AppError(400, 'BAD_AVATAR_REF', '头像须位于用户 avatars 目录下')
  }
  return normalized
}

/** 文件夹在 COS 中的完整 Key，须以 `/` 结尾，且位于用户根下（不含越级 `..`） */
function assertFullFolderKeyUnderUser(userId: string, folderKey: string): void {
  const k = folderKey.trim().replace(/^\/+/, '')
  if (!k.endsWith('/')) {
    throw new AppError(400, 'BAD_INPUT', '文件夹路径须以 / 结尾')
  }
  assertFullKeyUnderUser(userId, k)
}

function parentPathOfFolderKey(folderKey: string): string {
  const k = folderKey.trim().replace(/^\/+/, '')
  if (!k.endsWith('/')) return ''
  const withoutTrail = k.slice(0, -1)
  const i = withoutTrail.lastIndexOf('/')
  if (i < 0) return ''
  return `${withoutTrail.slice(0, i + 1)}`
}

/** 文件夹完整 Key（以 / 结尾）的最后一级目录名 */
function folderLastSegmentName(folderKey: string): string {
  const t = folderKey.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  const seg = t.split('/').filter((p) => p.length > 0)
  return seg.length ? seg[seg.length - 1]! : ''
}

type ListBucketPage = {
  Contents?: { Key?: string }[]
  CommonPrefixes?: { Prefix?: string }[]
  IsTruncated?: boolean
  NextMarker?: string
}

async function listAllObjectKeysWithPrefix(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let marker: string | undefined
  let guard = 0
  while (guard < 5000) {
    guard += 1
    const data = await cosCall<ListBucketPage>('getBucket', {
      Bucket: getCosConfig().bucket,
      Region: getCosConfig().region,
      Prefix: prefix,
      MaxKeys: 1000,
      Marker: marker,
    })
    const contents = data.Contents ?? []
    for (const c of contents) {
      const key = typeof c.Key === 'string' ? c.Key : ''
      if (key) keys.push(key)
    }
    if (!data.IsTruncated) break
    let next: string | undefined =
      typeof data.NextMarker === 'string' && data.NextMarker ? data.NextMarker : undefined
    if (!next && contents.length > 0) {
      const last = contents[contents.length - 1]
      const lk = typeof last?.Key === 'string' ? last.Key : ''
      if (lk) next = lk
    }
    if (!next) break
    marker = next
  }
  return keys
}

async function prefixHasAnyListedObject(prefix: string): Promise<boolean> {
  const data = await cosCall<ListBucketPage>('getBucket', {
    Bucket: getCosConfig().bucket,
    Region: getCosConfig().region,
    Prefix: prefix,
    MaxKeys: 1,
  })
  return (data.Contents ?? []).some((c) => typeof c.Key === 'string' && Boolean(c.Key))
}

type DeleteMultiResult = {
  Error?: { Key?: string; Code?: string; Message?: string } | { Key?: string; Code?: string; Message?: string }[]
}

async function deleteObjectKeysBatch(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const cos = await getCos()
  const chunk = 1000
  for (let i = 0; i < keys.length; i += chunk) {
    const slice = keys.slice(i, i + chunk).map((Key) => ({ Key }))
    const result = await new Promise<DeleteMultiResult>((resolve, reject) => {
      cos.deleteMultipleObject(
        {
          Bucket: getCosConfig().bucket,
          Region: getCosConfig().region,
          Objects: slice,
          Quiet: true,
          Headers: {},
        },
        (err: unknown, data?: DeleteMultiResult) => {
          if (err) reject(err)
          else resolve(data ?? {})
        }
      )
    }).catch((e) => mapCosError(e, '批量删除对象失败'))
    const errors = result.Error
    const errList: { Key?: string; Code?: string; Message?: string }[] = Array.isArray(errors)
      ? errors
      : errors && typeof errors === 'object'
        ? [errors as { Key?: string; Code?: string; Message?: string }]
        : []
    if (errList.some((e) => e && (e.Code || e.Message))) {
      throw new AppError(502, 'COS_ERROR', '批量删除对象失败')
    }
  }
}

function buildCopySource(bucket: string, region: string, key: string): string {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  return `${bucket}.cos.${region}.myqcloud.com/${encodedKey}`
}

function extFromFileName(name: string): string {
  const n = name.replace(/\\/g, '/').split('/').pop() || 'image'
  const lastDot = n.lastIndexOf('.')
  if (lastDot <= 0) return ''
  return n.slice(lastDot).toLowerCase()
}

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    default:
      return ''
  }
}

function resolveImageExtAndContentType(fileName: string, contentType?: string): { ext: string; contentType: string } {
  let ext = extFromFileName(fileName)
  if (!IMAGE_EXT.has(ext)) {
    const ct = (contentType || '').trim().toLowerCase()
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    }
    ext = map[ct] || ''
  }
  if (!IMAGE_EXT.has(ext)) {
    throw new AppError(400, 'UNSUPPORTED_IMAGE', '仅支持 jpg、jpeg、png、webp、gif 图片')
  }
  return { ext, contentType: contentTypeForExt(ext) }
}

async function cosCall<T>(method: keyof CosInstance, params: Record<string, unknown>): Promise<T> {
  const cos = await getCos()
  const fn = cos[method] as (p: Record<string, unknown>, cb: (err: unknown, data: T) => void) => void
  return new Promise((resolve, reject) => {
    fn.call(cos, params, (err: unknown, data: T) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

function mapCosError(err: unknown, fallback: string): never {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const sc = (err as { statusCode?: number }).statusCode
    const code = (err as { code?: string }).code
    if (sc === 404 || code === 'NoSuchKey') {
      throw new AppError(404, 'NOT_FOUND', '对象不存在')
    }
  }
  throw new AppError(502, 'COS_ERROR', fallback)
}

/** 在桶内创建用户根目录占位对象（`users/{userId}/`），幂等；未配置 COS 时直接返回 */
export async function ensureUserCosHome(userId: string): Promise<void> {
  if (!isCosConfigured()) return
  const key = userRoot(userId)
  await cosCall('putObject', {
    Bucket: getCosConfig().bucket,
    Region: getCosConfig().region,
    Key: key,
    Body: Buffer.alloc(0),
  })
}

export async function browse(userId: string, prefixRaw: string | undefined, delimiterRaw: string | undefined) {
  await prepareCos()
  try {
    await ensureUserCosHome(userId)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    writeAppLog('WARN', `[cos] browse ensureUserCosHome userId=${userId}`, detail)
  }
  const root = userRoot(userId)
  const rel = normalizeRelativeDir(prefixRaw ?? '')
  const listPrefix = `${root}${rel}`
  const delimiter = (delimiterRaw ?? '/').trim() || '/'

  type ListResult = {
    CommonPrefixes?: { Prefix?: string }[]
    Contents?: { Key?: string; Size?: string | number; LastModified?: string }[]
    IsTruncated?: boolean
    NextMarker?: string
  }

  let data: ListResult
  try {
    data = await cosCall<ListResult>('getBucket', {
      Bucket: getCosConfig().bucket,
      Region: getCosConfig().region,
      Prefix: listPrefix,
      Delimiter: delimiter,
      MaxKeys: 1000,
    })
  } catch (e) {
    mapCosError(e, '列出对象失败')
  }

  const stripRoot = (p: string) => (p.startsWith(root) ? p.slice(root.length) : p)

  const commonPrefixes = (data.CommonPrefixes ?? [])
    .map((x) => (typeof x.Prefix === 'string' ? stripRoot(x.Prefix) : ''))
    .filter(Boolean)

  const objects: { key: string; size: number; lastModified: string | null }[] = []
  for (const c of data.Contents ?? []) {
    const key = typeof c.Key === 'string' ? c.Key : ''
    if (!key || key === listPrefix) continue
    if (key.endsWith('/')) continue
    const size = typeof c.Size === 'number' ? c.Size : Number(c.Size || 0)
    const lastModified = typeof c.LastModified === 'string' ? c.LastModified : null
    objects.push({ key, size, lastModified })
  }

  return {
    scopePrefix: root,
    currentPrefix: rel,
    delimiter,
    commonPrefixes,
    objects,
    isTruncated: Boolean(data.IsTruncated),
    nextMarker: data.NextMarker ?? null,
  }
}

function isImageObjectKey(key: string): boolean {
  const base = key.split('/').filter(Boolean).pop() || ''
  const ext = extFromFileName(base)
  return IMAGE_EXT.has(ext)
}

/** 扁平列举用户根下全部对象，统计图片数量与总字节（分页直至结束） */
export async function imageStats(userId: string): Promise<{ imageCount: number; totalBytes: number }> {
  await prepareCos()
  try {
    await ensureUserCosHome(userId)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    writeAppLog('WARN', `[cos] imageStats ensureUserCosHome userId=${userId}`, detail)
  }

  const root = userRoot(userId)
  type FlatPage = {
    Contents?: { Key?: string; Size?: string | number }[]
    IsTruncated?: boolean
    NextMarker?: string
  }

  let imageCount = 0
  let totalBytes = 0
  let marker: string | undefined
  let guard = 0

  while (guard < 5000) {
    guard += 1
    let data: FlatPage
    try {
      data = await cosCall<FlatPage>('getBucket', {
        Bucket: getCosConfig().bucket,
        Region: getCosConfig().region,
        Prefix: root,
        MaxKeys: 1000,
        Marker: marker,
      })
    } catch (e) {
      mapCosError(e, '统计对象失败')
    }

    const contents = data.Contents ?? []
    for (const c of contents) {
      const key = typeof c.Key === 'string' ? c.Key : ''
      if (!key || key === root) continue
      if (key.endsWith('/')) continue
      if (!isImageObjectKey(key)) continue
      const size = typeof c.Size === 'number' ? c.Size : Number(c.Size || 0)
      imageCount += 1
      totalBytes += size
    }

    if (!data.IsTruncated) break
    let next: string | undefined =
      typeof data.NextMarker === 'string' && data.NextMarker ? data.NextMarker : undefined
    if (!next && contents.length > 0) {
      const last = contents[contents.length - 1]
      const lk = typeof last?.Key === 'string' ? last.Key : ''
      if (lk) next = lk
    }
    if (!next) break
    marker = next
  }

  return { imageCount, totalBytes }
}

export async function presignUpload(
  userId: string,
  body: { fileName: string; contentType?: string; parentPrefix?: string }
) {
  await prepareCos()
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : ''
  if (!fileName) throw new AppError(400, 'BAD_INPUT', '缺少 fileName')

  const parentRel = normalizeRelativeDir(body.parentPrefix ?? '')
  const { ext, contentType } = resolveImageExtAndContentType(fileName, body.contentType)

  const id = randomUUID()
  const objectKey = `${userRoot(userId)}${parentRel}${id}${ext}`

  const expires = Math.min(Math.max(getCosConfig().presignPutExpiresSec, 60), 3600)
  const cos = await getCos()

  // 预签名 URL 不要签入 Content-Type：浏览器 fetch 对 File 可能自动带或与签名不一致，导致 403 SignatureDoesNotMatch
  const url = await new Promise<string>((resolve, reject) => {
    cos.getObjectUrl(
      {
        Bucket: getCosConfig().bucket,
        Region: getCosConfig().region,
        Key: objectKey,
        Sign: true,
        Method: 'PUT',
        Expires: expires,
      },
      (err: unknown, data?: { Url?: string }) => {
        if (err) reject(err)
        else if (data?.Url) resolve(data.Url)
        else reject(new Error('empty presign url'))
      }
    )
  }).catch((e) => mapCosError(e, '生成上传地址失败'))

  const expiresAt = Date.now() + expires * 1000

  return {
    key: objectKey,
    method: 'PUT' as const,
    url,
    headers: { 'Content-Type': contentType },
    maxBytes: getCosConfig().uploadMaxBytes,
    expiresAt,
  }
}

export async function uploadObjectBuffer(
  userId: string,
  input: { fileName: string; parentPrefix?: string; buffer: Buffer }
): Promise<{ key: string; size: number }> {
  await prepareCos()
  const fileName = typeof input.fileName === 'string' ? input.fileName.trim() : ''
  if (!fileName) throw new AppError(400, 'BAD_INPUT', '缺少 fileName')
  if (!input.buffer || input.buffer.length === 0) {
    throw new AppError(400, 'BAD_INPUT', '空文件')
  }
  if (input.buffer.length > getCosConfig().uploadMaxBytes) {
    throw new AppError(
      413,
      'PAYLOAD_TOO_LARGE',
      `文件超过服务端允许大小（${getCosConfig().uploadMaxBytes} 字节）`
    )
  }
  const parentRel = normalizeRelativeDir(input.parentPrefix ?? '')
  const { ext, contentType } = resolveImageExtAndContentType(fileName, undefined)
  const id = randomUUID()
  const objectKey = `${userRoot(userId)}${parentRel}${id}${ext}`
  try {
    await cosCall('putObject', {
      Bucket: getCosConfig().bucket,
      Region: getCosConfig().region,
      Key: objectKey,
      Body: input.buffer,
      Headers: { 'Content-Type': contentType },
    })
  } catch (e) {
    mapCosError(e, '上传对象失败')
  }
  return { key: objectKey, size: input.buffer.length }
}

export type CosPresignGetVariant = 'full' | 'thumb'

/** 云图库网格缩略图：COS 基础图片处理（需桶开通数据万象/图片处理） */
function cosThumbImageQuery(key: string): Record<string, string> {
  const ext = (key.split('.').pop() || '').toLowerCase()
  if (ext === 'gif') {
    return { 'imageMogr2/thumbnail/320x': '' }
  }
  return { 'imageMogr2/thumbnail/320x/format/jpg/quality/80': '' }
}

export async function presignGet(
  userId: string,
  body: { key: string; variant?: CosPresignGetVariant }
) {
  await prepareCos()
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  if (!key) throw new AppError(400, 'BAD_INPUT', '缺少 key')
  assertFullKeyUnderUser(userId, key)

  const variant: CosPresignGetVariant = body.variant === 'thumb' ? 'thumb' : 'full'
  const query = variant === 'thumb' ? cosThumbImageQuery(key) : undefined

  const expires = Math.min(Math.max(getCosConfig().presignGetExpiresSec, 60), 3600)
  const cos = await getCos()

  const previewUrl = await new Promise<string>((resolve, reject) => {
    cos.getObjectUrl(
      {
        Bucket: getCosConfig().bucket,
        Region: getCosConfig().region,
        Key: key,
        Sign: true,
        Method: 'GET',
        Expires: expires,
        ...(query ? { Query: query } : {}),
      },
      (err: unknown, data?: { Url?: string }) => {
        if (err) reject(err)
        else if (data?.Url) resolve(data.Url)
        else reject(new Error('empty presign url'))
      }
    )
  }).catch((e) => mapCosError(e, '生成预览地址失败'))

  return { previewUrl, expiresAt: Date.now() + expires * 1000 }
}

export async function mkdir(userId: string, body: { parentPrefix?: string; name: string }) {
  await prepareCos()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.includes('/') || name === '.' || name === '..') {
    throw new AppError(400, 'BAD_INPUT', '文件夹名称不合法')
  }
  const parentRel = normalizeRelativeDir(body.parentPrefix ?? '')
  const folderKey = `${userRoot(userId)}${parentRel}${name}/`

  try {
    await cosCall('putObject', {
      Bucket: getCosConfig().bucket,
      Region: getCosConfig().region,
      Key: folderKey,
      Body: Buffer.alloc(0),
    })
  } catch (e) {
    mapCosError(e, '创建文件夹失败')
  }

  return { key: folderKey }
}

async function headExists(key: string): Promise<boolean> {
  try {
    await cosCall('headObject', {
      Bucket: getCosConfig().bucket,
      Region: getCosConfig().region,
      Key: key,
    })
    return true
  } catch (e) {
    if (e && typeof e === 'object' && 'statusCode' in e && (e as { statusCode: number }).statusCode === 404) {
      return false
    }
    mapCosError(e, '检查目标路径失败')
  }
}

export async function moveObject(userId: string, body: { fromKey: string; toKey: string }) {
  await prepareCos()
  const fromKey = typeof body.fromKey === 'string' ? body.fromKey.trim() : ''
  const toKey = typeof body.toKey === 'string' ? body.toKey.trim() : ''
  if (!fromKey || !toKey) throw new AppError(400, 'BAD_INPUT', '缺少 fromKey 或 toKey')
  assertFullKeyUnderUser(userId, fromKey)
  assertFullKeyUnderUser(userId, toKey)
  if (fromKey === toKey) throw new AppError(400, 'BAD_INPUT', '源与目标相同')

  if (await headExists(toKey)) {
    throw new AppError(409, 'ALREADY_EXISTS', '目标路径已存在对象')
  }

  const copySource = buildCopySource(getCosConfig().bucket, getCosConfig().region, fromKey)

  try {
    await cosCall('putObjectCopy', {
      Bucket: getCosConfig().bucket,
      Region: getCosConfig().region,
      Key: toKey,
      CopySource: copySource,
    })
    await cosCall('deleteObject', {
      Bucket: getCosConfig().bucket,
      Region: getCosConfig().region,
      Key: fromKey,
    })
  } catch (e) {
    mapCosError(e, '移动对象失败')
  }

  return { key: toKey }
}

export async function deleteObject(userId: string, body: { key: string }) {
  await prepareCos()
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  if (!key) throw new AppError(400, 'BAD_INPUT', '缺少 key')
  assertFullKeyUnderUser(userId, key)

  try {
    await cosCall('deleteObject', {
      Bucket: getCosConfig().bucket,
      Region: getCosConfig().region,
      Key: key,
    })
  } catch (e) {
    mapCosError(e, '删除对象失败')
  }

  return { ok: true as const }
}

export async function renameFolder(userId: string, body: { fromKey: string; newName: string }) {
  await prepareCos()
  const fromKey = typeof body.fromKey === 'string' ? body.fromKey.trim().replace(/^\/+/, '') : ''
  const newName = typeof body.newName === 'string' ? body.newName.trim() : ''
  if (!fromKey || !fromKey.endsWith('/')) {
    throw new AppError(400, 'BAD_INPUT', 'fromKey 须为以 / 结尾的文件夹路径')
  }
  if (!newName || newName.includes('/') || newName === '.' || newName === '..') {
    throw new AppError(400, 'BAD_INPUT', '新文件夹名称不合法')
  }
  assertFullFolderKeyUnderUser(userId, fromKey)
  const parent = parentPathOfFolderKey(fromKey)
  const toKey = `${parent}${newName}/`
  assertFullFolderKeyUnderUser(userId, toKey)
  if (fromKey === toKey) throw new AppError(400, 'BAD_INPUT', '名称未改变')

  if (await prefixHasAnyListedObject(toKey)) {
    throw new AppError(409, 'ALREADY_EXISTS', '目标文件夹路径已存在')
  }

  const keys = await listAllObjectKeysWithPrefix(fromKey)
  if (keys.length === 0) {
    throw new AppError(404, 'NOT_FOUND', '文件夹不存在或无可迁移内容')
  }

  for (const oldK of keys) {
    const newK = `${toKey}${oldK.slice(fromKey.length)}`
    if (oldK === newK) continue
    const copySource = buildCopySource(getCosConfig().bucket, getCosConfig().region, oldK)
    try {
      await cosCall('putObjectCopy', {
        Bucket: getCosConfig().bucket,
        Region: getCosConfig().region,
        Key: newK,
        CopySource: copySource,
      })
    } catch (e) {
      mapCosError(e, '复制对象失败')
    }
  }

  try {
    await deleteObjectKeysBatch(keys)
  } catch (e) {
    mapCosError(e, '删除旧路径对象失败')
  }

  return { key: toKey }
}

export async function moveFolder(userId: string, body: { fromKey: string; targetParentPrefix?: string }) {
  await prepareCos()
  const fromKey = typeof body.fromKey === 'string' ? body.fromKey.trim().replace(/^\/+/, '') : ''
  if (!fromKey || !fromKey.endsWith('/')) {
    throw new AppError(400, 'BAD_INPUT', 'fromKey 须为以 / 结尾的文件夹路径')
  }
  assertFullFolderKeyUnderUser(userId, fromKey)

  const root = userRoot(userId)
  if (fromKey === root) {
    throw new AppError(400, 'BAD_INPUT', '不能移动用户根目录')
  }

  const folderName = folderLastSegmentName(fromKey)
  if (!folderName) {
    throw new AppError(400, 'BAD_INPUT', '无法解析文件夹名称')
  }

  const parentRel = normalizeRelativeDir(body.targetParentPrefix ?? '')
  const toKey = `${root}${parentRel}${folderName}/`
  assertFullFolderKeyUnderUser(userId, toKey)

  if (fromKey === toKey) {
    throw new AppError(400, 'BAD_INPUT', '目标位置与当前相同')
  }
  if (toKey.startsWith(fromKey)) {
    throw new AppError(400, 'BAD_INPUT', '不能将文件夹移动到其自身或子路径下')
  }

  if (await prefixHasAnyListedObject(toKey)) {
    throw new AppError(409, 'ALREADY_EXISTS', '目标位置已存在同名文件夹或对象')
  }

  const keys = await listAllObjectKeysWithPrefix(fromKey)
  if (keys.length === 0) {
    throw new AppError(404, 'NOT_FOUND', '文件夹不存在或无可迁移内容')
  }

  for (const oldK of keys) {
    const newK = `${toKey}${oldK.slice(fromKey.length)}`
    if (oldK === newK) continue
    const copySource = buildCopySource(getCosConfig().bucket, getCosConfig().region, oldK)
    try {
      await cosCall('putObjectCopy', {
        Bucket: getCosConfig().bucket,
        Region: getCosConfig().region,
        Key: newK,
        CopySource: copySource,
      })
    } catch (e) {
      mapCosError(e, '复制对象失败')
    }
  }

  try {
    await deleteObjectKeysBatch(keys)
  } catch (e) {
    mapCosError(e, '删除旧路径对象失败')
  }

  return { key: toKey }
}

export async function deleteFolder(userId: string, body: { key: string }) {
  await prepareCos()
  const folderKey = typeof body.key === 'string' ? body.key.trim().replace(/^\/+/, '') : ''
  if (!folderKey || !folderKey.endsWith('/')) {
    throw new AppError(400, 'BAD_INPUT', '须指定以 / 结尾的文件夹路径')
  }
  assertFullFolderKeyUnderUser(userId, folderKey)

  const keys = await listAllObjectKeysWithPrefix(folderKey)
  if (keys.length === 0) {
    return { ok: true as const, deleted: 0 }
  }
  try {
    await deleteObjectKeysBatch(keys)
  } catch (e) {
    mapCosError(e, '删除文件夹失败')
  }

  return { ok: true as const, deleted: keys.length }
}
