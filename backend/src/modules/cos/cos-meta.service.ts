import { randomUUID } from 'node:crypto'
import { getPool } from '../../db/pool.js'
import { AppError } from '../../utils/AppError.js'
import { assertFullKeyUnderUser } from './cos.service.js'
import * as metaRepo from './cos-meta.repository.js'

export const cosMetaService = {
  async batchUpsert(
    userId: string,
    body: {
      items?: unknown
    }
  ) {
    if (!Array.isArray(body.items)) throw new AppError(400, 'BAD_INPUT', 'items 须为数组')
    if (body.items.length > 500) throw new AppError(400, 'BAD_INPUT', '单次最多 500 条')

    const pool = getPool()
    const now = Date.now()
    let count = 0

    for (const raw of body.items) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as Record<string, unknown>
      const cosKey = typeof item.cosKey === 'string' ? item.cosKey.trim().replace(/^\/+/, '') : ''
      if (!cosKey || cosKey.endsWith('/')) continue
      assertFullKeyUnderUser(userId, cosKey)

      const contentCategory =
        typeof item.contentCategory === 'string' && item.contentCategory.trim()
          ? item.contentCategory.trim().slice(0, 32)
          : null

      let qualityPass: number | null = null
      if (item.qualityPass === true || item.qualityPass === 1) qualityPass = 1
      else if (item.qualityPass === false || item.qualityPass === 0) qualityPass = 0

      let qualityIssuesJson: string | null = null
      if (Array.isArray(item.qualityIssues)) {
        qualityIssuesJson = JSON.stringify(item.qualityIssues.slice(0, 20))
      }

      const exifCaptureAt =
        typeof item.exifCaptureAt === 'number' && Number.isFinite(item.exifCaptureAt)
          ? Math.floor(item.exifCaptureAt)
          : null

      await metaRepo.upsertCosObjectMeta(pool, {
        id: randomUUID(),
        owner_user_id: userId,
        cos_key: cosKey,
        content_category: contentCategory,
        quality_pass: qualityPass,
        quality_issues_json: qualityIssuesJson,
        exif_capture_at: exifCaptureAt,
        created_at: now,
        updated_at: now,
      })
      count += 1
    }

    return { updated: count }
  },

  async listByPrefix(userId: string, prefixRaw: unknown) {
    const prefix = typeof prefixRaw === 'string' ? prefixRaw.trim().replace(/^\/+/, '') : ''
    if (!prefix.endsWith('/')) throw new AppError(400, 'BAD_INPUT', 'prefix 须以 / 结尾')
    assertFullKeyUnderUser(userId, prefix)

    const rows = await metaRepo.listCosObjectMetaByPrefix(getPool(), userId, prefix)
    return {
      items: rows.map((r) => ({
        cosKey: r.cos_key,
        contentCategory: r.content_category,
        qualityPass: r.quality_pass === null ? null : Number(r.quality_pass) === 1,
        qualityIssues: r.quality_issues_json ? (JSON.parse(r.quality_issues_json) as unknown) : null,
        exifCaptureAt: r.exif_capture_at,
        updatedAt: r.updated_at,
      })),
    }
  },
}
