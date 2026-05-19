import type { DbExecutor } from './parameters.repository.js'
import {
  DEFAULT_COS_PRESIGN_GET_EXPIRES_SEC,
  DEFAULT_COS_PRESIGN_PUT_EXPIRES_SEC,
  DEFAULT_COS_UPLOAD_MAX_BYTES,
  getIntParam,
  getStringParam,
  PARAM_COS_BUCKET,
  PARAM_COS_KEY_PREFIX,
  PARAM_COS_PRESIGN_GET_EXPIRES_SEC,
  PARAM_COS_PRESIGN_PUT_EXPIRES_SEC,
  PARAM_COS_REGION,
  PARAM_COS_SECRET_ID,
  PARAM_COS_SECRET_KEY,
  PARAM_COS_UPLOAD_MAX_BYTES,
} from './parameters.repository.js'

export type CosRuntimeConfig = {
  secretId: string
  secretKey: string
  region: string
  bucket: string
  keyPrefix: string
  uploadMaxBytes: number
  presignPutExpiresSec: number
  presignGetExpiresSec: number
}

const REFRESH_MS = 60_000

let cached: CosRuntimeConfig = emptyConfig()
let lastLoadedAt = 0
let invalidateClient: (() => void) | null = null

function emptyConfig(): CosRuntimeConfig {
  return {
    secretId: '',
    secretKey: '',
    region: '',
    bucket: '',
    keyPrefix: '',
    uploadMaxBytes: DEFAULT_COS_UPLOAD_MAX_BYTES,
    presignPutExpiresSec: DEFAULT_COS_PRESIGN_PUT_EXPIRES_SEC,
    presignGetExpiresSec: DEFAULT_COS_PRESIGN_GET_EXPIRES_SEC,
  }
}

export function registerCosClientInvalidator(fn: () => void): void {
  invalidateClient = fn
}

export function normalizeCosKeyPrefix(v: string): string {
  const t = v.trim().replace(/^\/+/, '')
  if (!t) return ''
  return t.endsWith('/') ? t : `${t}/`
}

export function isCosConfigured(): boolean {
  const c = cached
  return Boolean(c.secretId && c.secretKey && c.region && c.bucket)
}

export function getCosConfig(): CosRuntimeConfig {
  return cached
}

export async function loadCosConfig(db: DbExecutor): Promise<void> {
  const [secretId, secretKey, region, bucket, keyPrefixRaw] = await Promise.all([
    getStringParam(db, PARAM_COS_SECRET_ID),
    getStringParam(db, PARAM_COS_SECRET_KEY),
    getStringParam(db, PARAM_COS_REGION),
    getStringParam(db, PARAM_COS_BUCKET),
    getStringParam(db, PARAM_COS_KEY_PREFIX),
  ])
  const uploadMaxBytes = await getIntParam(db, PARAM_COS_UPLOAD_MAX_BYTES, DEFAULT_COS_UPLOAD_MAX_BYTES)
  const presignPutExpiresSec = await getIntParam(
    db,
    PARAM_COS_PRESIGN_PUT_EXPIRES_SEC,
    DEFAULT_COS_PRESIGN_PUT_EXPIRES_SEC
  )
  const presignGetExpiresSec = await getIntParam(
    db,
    PARAM_COS_PRESIGN_GET_EXPIRES_SEC,
    DEFAULT_COS_PRESIGN_GET_EXPIRES_SEC
  )

  cached = {
    secretId: secretId ?? '',
    secretKey: secretKey ?? '',
    region: region ?? '',
    bucket: bucket ?? '',
    keyPrefix: normalizeCosKeyPrefix(keyPrefixRaw ?? ''),
    uploadMaxBytes: Math.min(Math.max(uploadMaxBytes, 1), 1073741824),
    presignPutExpiresSec: Math.min(Math.max(presignPutExpiresSec, 60), 3600),
    presignGetExpiresSec: Math.min(Math.max(presignGetExpiresSec, 60), 3600),
  }
  lastLoadedAt = Date.now()
  invalidateClient?.()
}

export async function maybeRefreshCosConfig(db: DbExecutor): Promise<void> {
  if (Date.now() - lastLoadedAt < REFRESH_MS) return
  await loadCosConfig(db)
}

export function maskSecretId(secretId: string): string | null {
  if (!secretId) return null
  if (secretId.length <= 8) return '***'
  return `${secretId.slice(0, 4)}***${secretId.slice(-4)}`
}
