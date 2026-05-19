import { getPool } from '../../db/pool.js'
import { writeAppLog } from '../../logger/appLogger.js'
import { AppError } from '../../utils/AppError.js'
import {
  loadCosConfig,
  getCosConfig,
  isCosConfigured,
  maskSecretId,
  normalizeCosKeyPrefix,
} from '../parameters/cosConfig.service.js'
import {
  PARAM_COS_BUCKET,
  PARAM_COS_KEY_PREFIX,
  PARAM_COS_PRESIGN_GET_EXPIRES_SEC,
  PARAM_COS_PRESIGN_PUT_EXPIRES_SEC,
  PARAM_COS_REGION,
  PARAM_COS_SECRET_ID,
  PARAM_COS_SECRET_KEY,
  PARAM_COS_UPLOAD_MAX_BYTES,
  setIntParam,
  setStringParam,
} from '../parameters/parameters.repository.js'

export type CosConfigPublicView = {
  configured: boolean
  secretId: string | null
  secretKeyConfigured: boolean
  region: string | null
  bucket: string | null
  keyPrefix: string
  uploadMaxBytes: number
  presignPutExpiresSec: number
  presignGetExpiresSec: number
}

function toPublicView(): CosConfigPublicView {
  const c = getCosConfig()
  return {
    configured: isCosConfigured(),
    secretId: maskSecretId(c.secretId),
    secretKeyConfigured: Boolean(c.secretKey),
    region: c.region || null,
    bucket: c.bucket || null,
    keyPrefix: c.keyPrefix,
    uploadMaxBytes: c.uploadMaxBytes,
    presignPutExpiresSec: c.presignPutExpiresSec,
    presignGetExpiresSec: c.presignGetExpiresSec,
  }
}

export const adminService = {
  async getCosParameters(): Promise<CosConfigPublicView> {
    await loadCosConfig(getPool())
    return toPublicView()
  },

  async updateCosParameters(
    operatorUserId: string,
    body: unknown
  ): Promise<CosConfigPublicView> {
    const b = body as Record<string, unknown>
    const pool = getPool()
    const changedKeys: string[] = []

    if (typeof b.secretId === 'string') {
      const v = b.secretId.trim()
      if (v.length > 128) throw new AppError(400, 'BAD_INPUT', 'secretId 过长')
      await setStringParam(pool, PARAM_COS_SECRET_ID, v || null)
      changedKeys.push(PARAM_COS_SECRET_ID)
    }
    if (typeof b.secretKey === 'string') {
      const v = b.secretKey.trim()
      if (v.length > 128) throw new AppError(400, 'BAD_INPUT', 'secretKey 过长')
      await setStringParam(pool, PARAM_COS_SECRET_KEY, v || null)
      changedKeys.push(PARAM_COS_SECRET_KEY)
    }
    if (typeof b.region === 'string') {
      const v = b.region.trim()
      if (v.length > 64) throw new AppError(400, 'BAD_INPUT', 'region 过长')
      await setStringParam(pool, PARAM_COS_REGION, v || null)
      changedKeys.push(PARAM_COS_REGION)
    }
    if (typeof b.bucket === 'string') {
      const v = b.bucket.trim()
      if (v.length > 128) throw new AppError(400, 'BAD_INPUT', 'bucket 过长')
      await setStringParam(pool, PARAM_COS_BUCKET, v || null)
      changedKeys.push(PARAM_COS_BUCKET)
    }
    if (typeof b.keyPrefix === 'string') {
      const v = normalizeCosKeyPrefix(b.keyPrefix)
      await setStringParam(pool, PARAM_COS_KEY_PREFIX, v || null)
      changedKeys.push(PARAM_COS_KEY_PREFIX)
    }
    if (b.uploadMaxBytes !== undefined) {
      const n = Number(b.uploadMaxBytes)
      if (!Number.isFinite(n) || n < 1 || n > 1073741824) {
        throw new AppError(400, 'BAD_INPUT', 'uploadMaxBytes 须在 1～1073741824 之间')
      }
      await setIntParam(pool, PARAM_COS_UPLOAD_MAX_BYTES, Math.floor(n))
      changedKeys.push(PARAM_COS_UPLOAD_MAX_BYTES)
    }
    if (b.presignPutExpiresSec !== undefined) {
      const n = Number(b.presignPutExpiresSec)
      if (!Number.isFinite(n) || n < 60 || n > 3600) {
        throw new AppError(400, 'BAD_INPUT', 'presignPutExpiresSec 须在 60～3600 之间')
      }
      await setIntParam(pool, PARAM_COS_PRESIGN_PUT_EXPIRES_SEC, Math.floor(n))
      changedKeys.push(PARAM_COS_PRESIGN_PUT_EXPIRES_SEC)
    }
    if (b.presignGetExpiresSec !== undefined) {
      const n = Number(b.presignGetExpiresSec)
      if (!Number.isFinite(n) || n < 60 || n > 3600) {
        throw new AppError(400, 'BAD_INPUT', 'presignGetExpiresSec 须在 60～3600 之间')
      }
      await setIntParam(pool, PARAM_COS_PRESIGN_GET_EXPIRES_SEC, Math.floor(n))
      changedKeys.push(PARAM_COS_PRESIGN_GET_EXPIRES_SEC)
    }

    if (changedKeys.length === 0) {
      throw new AppError(400, 'BAD_INPUT', '未提供可更新的 COS 配置字段')
    }

    writeAppLog('INFO', `[admin] cos parameters updated by userId=${operatorUserId} keys=${changedKeys.join(',')}`)
    await loadCosConfig(pool)
    return toPublicView()
  },
}
