import { randomUUID } from 'node:crypto'
import { getPool } from '../../db/pool.js'
import { writeAppLog } from '../../logger/appLogger.js'
import { AppError } from '../../utils/AppError.js'
import { imageStats, isCosConfigured } from '../cos/cos.service.js'
import { getCosUserStorageQuotaBytes } from '../parameters/parameters.repository.js'
import * as quotaRepo from './admin.userQuota.repository.js'
import type { UserCosQuotaListRow } from './admin.userQuota.repository.js'

const MIN_QUOTA_BYTES = 1
const MAX_QUOTA_BYTES = 1099511627776

function clampQuotaBytes(n: number): number {
  return Math.min(Math.max(Math.floor(n), MIN_QUOTA_BYTES), MAX_QUOTA_BYTES)
}

async function mapRowsWithUsage(
  rows: UserCosQuotaListRow[]
): Promise<
  {
    userId: string
    email: string
    displayName: string
    quotaBytes: number
    createdAt: number
    usage: { imageCount: number; totalBytes: number } | null
  }[]
> {
  if (!isCosConfigured() || rows.length === 0) {
    return rows.map((row) => ({
      userId: row.id,
      email: row.email,
      displayName: row.display_name,
      quotaBytes: clampQuotaBytes(Number(row.cos_storage_quota_bytes)),
      createdAt: Number(row.created_at),
      usage: null,
    }))
  }
  const concurrency = 4
  const out: {
    userId: string
    email: string
    displayName: string
    quotaBytes: number
    createdAt: number
    usage: { imageCount: number; totalBytes: number } | null
  }[] = []
  for (let i = 0; i < rows.length; i += concurrency) {
    const chunk = rows.slice(i, i + concurrency)
    const part = await Promise.all(
      chunk.map(async (row) => {
        let usage: { imageCount: number; totalBytes: number } | null = null
        try {
          const stats = await imageStats(row.id)
          usage = { imageCount: stats.imageCount, totalBytes: stats.totalBytes }
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e)
          writeAppLog('WARN', `[admin] listUserCosQuota imageStats userId=${row.id}`, detail)
        }
        return {
          userId: row.id,
          email: row.email,
          displayName: row.display_name,
          quotaBytes: clampQuotaBytes(Number(row.cos_storage_quota_bytes)),
          createdAt: Number(row.created_at),
          usage,
        }
      })
    )
    out.push(...part)
  }
  return out
}

function usagePercent(
  usage: { totalBytes: number } | null,
  quotaBytes: number
): number | null {
  if (!usage || quotaBytes <= 0) return null
  return Math.round((usage.totalBytes / quotaBytes) * 100)
}

function parseListQuery(query: Record<string, unknown>) {
  const keyword = typeof query.keyword === 'string' ? query.keyword.trim() : ''
  const minQuotaGb = query.minQuotaGb != null ? Number(query.minQuotaGb) : undefined
  const maxQuotaGb = typeof query.maxQuotaGb === 'string' || typeof query.maxQuotaGb === 'number' ? Number(query.maxQuotaGb) : undefined
  const page = Math.max(1, Math.floor(Number(query.page ?? 1)))
  const pageSize = Math.min(Math.max(Math.floor(Number(query.pageSize ?? 20)), 1), 100)
  const sortByRaw = typeof query.sortBy === 'string' ? query.sortBy : 'createdAt'
  const sortBy: quotaRepo.UserCosQuotaListSortBy =
    sortByRaw === 'email' || sortByRaw === 'displayName' || sortByRaw === 'quotaBytes' || sortByRaw === 'createdAt'
      ? sortByRaw
      : 'createdAt'
  const sortOrder: 'asc' | 'desc' = query.sortOrder === 'asc' ? 'asc' : 'desc'
  const withUsage = query.withUsage === '1' || query.withUsage === 'true'
  const usageLevel =
    query.usageLevel === 'high' || query.usageLevel === 'over' ? query.usageLevel : 'all'

  const minQuotaBytes =
    minQuotaGb != null && Number.isFinite(minQuotaGb) && minQuotaGb > 0
      ? Math.floor(minQuotaGb * 1024 * 1024 * 1024)
      : undefined
  const maxQuotaBytes =
    maxQuotaGb != null && Number.isFinite(maxQuotaGb) && maxQuotaGb > 0
      ? Math.floor(maxQuotaGb * 1024 * 1024 * 1024)
      : undefined

  return {
    keyword: keyword || undefined,
    minQuotaBytes,
    maxQuotaBytes,
    page,
    pageSize,
    sortBy,
    sortOrder,
    withUsage,
    usageLevel,
    offset: (page - 1) * pageSize,
  }
}

function resolveTargetUser(query: { userId?: string; email?: string }) {
  const userId = typeof query.userId === 'string' ? query.userId.trim() : ''
  const email = typeof query.email === 'string' ? query.email.trim().toLowerCase() : ''
  if (!userId && !email) {
    throw new AppError(400, 'BAD_INPUT', '请提供 userId 或 email')
  }
  if (userId && email) {
    throw new AppError(400, 'BAD_INPUT', 'userId 与 email 只能二选一')
  }
  return { userId: userId || undefined, email: email || undefined }
}

export const adminUserQuotaService = {
  async listUsersCosQuota(query: Record<string, unknown>) {
    const parsed = parseListQuery(query)
    const pool = getPool()
    const defaultQuotaBytes = await getCosUserStorageQuotaBytes(pool)
    const baseFilters = {
      keyword: parsed.keyword,
      minQuotaBytes: parsed.minQuotaBytes,
      maxQuotaBytes: parsed.maxQuotaBytes,
      sortBy: parsed.sortBy,
      sortOrder: parsed.sortOrder,
    }

    const needsUsageFilter = parsed.withUsage && parsed.usageLevel !== 'all'

    if (needsUsageFilter) {
      const rows = await quotaRepo.listAllUsersCosQuotaForUsageFilter(pool, baseFilters)
      let items = await mapRowsWithUsage(rows)
      if (parsed.usageLevel === 'high') {
        items = items.filter((it) => {
          const p = usagePercent(it.usage, it.quotaBytes)
          return p != null && p >= 90
        })
      } else if (parsed.usageLevel === 'over') {
        items = items.filter((it) => {
          const p = usagePercent(it.usage, it.quotaBytes)
          return p != null && p >= 100
        })
      }
      const total = items.length
      const pageItems = items.slice(parsed.offset, parsed.offset + parsed.pageSize)
      return {
        items: pageItems,
        total,
        page: parsed.page,
        pageSize: parsed.pageSize,
        defaultQuotaBytesForNewUsers: defaultQuotaBytes,
        cosConfigured: isCosConfigured(),
      }
    }

    const total = await quotaRepo.countUsersCosQuota(pool, baseFilters)
    const rows = await quotaRepo.listUsersCosQuota(pool, {
      ...baseFilters,
      offset: parsed.offset,
      limit: parsed.pageSize,
    })
    const items = parsed.withUsage
      ? await mapRowsWithUsage(rows)
      : rows.map((row) => ({
          userId: row.id,
          email: row.email,
          displayName: row.display_name,
          quotaBytes: clampQuotaBytes(Number(row.cos_storage_quota_bytes)),
          createdAt: Number(row.created_at),
          usage: null as { imageCount: number; totalBytes: number } | null,
        }))

    return {
      items,
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
      defaultQuotaBytesForNewUsers: defaultQuotaBytes,
      cosConfigured: isCosConfigured(),
    }
  },

  async getUserCosQuota(query: { userId?: string; email?: string }) {
    const target = resolveTargetUser(query)
    const pool = getPool()
    const row = target.userId
      ? await quotaRepo.findUserCosQuotaById(pool, target.userId)
      : await quotaRepo.findUserCosQuotaByEmail(pool, target.email!)
    if (!row) {
      throw new AppError(404, 'USER_NOT_FOUND', '用户不存在')
    }

    const defaultQuotaBytes = await getCosUserStorageQuotaBytes(pool)
    let usage: { imageCount: number; totalBytes: number } | null = null
    if (isCosConfigured()) {
      try {
        const stats = await imageStats(row.id)
        usage = { imageCount: stats.imageCount, totalBytes: stats.totalBytes }
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e)
        writeAppLog('WARN', `[admin] getUserCosQuota imageStats userId=${row.id}`, detail)
      }
    }

    return {
      userId: row.id,
      email: row.email,
      displayName: row.display_name,
      quotaBytes: clampQuotaBytes(Number(row.cos_storage_quota_bytes)),
      defaultQuotaBytesForNewUsers: defaultQuotaBytes,
      usage,
    }
  },

  async adjustUserCosQuota(
    operatorUserId: string,
    body: unknown
  ): Promise<{
    userId: string
    email: string
    displayName: string
    previousQuotaBytes: number
    newQuotaBytes: number
    deltaBytes: number
  }> {
    const b = body as {
      userId?: unknown
      email?: unknown
      quotaBytes?: unknown
      addQuotaBytes?: unknown
      remark?: unknown
    }
    const target = resolveTargetUser({
      userId: typeof b.userId === 'string' ? b.userId : undefined,
      email: typeof b.email === 'string' ? b.email : undefined,
    })

    const hasSet = b.quotaBytes !== undefined && b.quotaBytes !== null
    const hasAdd = b.addQuotaBytes !== undefined && b.addQuotaBytes !== null
    if (hasSet === hasAdd) {
      throw new AppError(400, 'BAD_INPUT', '请指定 quotaBytes（设为绝对值）或 addQuotaBytes（充值增量），且只能二选一')
    }

    const remark =
      typeof b.remark === 'string' && b.remark.trim() ? b.remark.trim().slice(0, 256) : null

    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [lockRows] = target.userId
        ? await conn.execute<quotaRepo.UserCosQuotaRow[]>(
            'SELECT id, email, display_name, cos_storage_quota_bytes FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
            [target.userId]
          )
        : await conn.execute<quotaRepo.UserCosQuotaRow[]>(
            'SELECT id, email, display_name, cos_storage_quota_bytes FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
            [target.email!]
          )
      const row = lockRows[0]
      if (!row) {
        throw new AppError(404, 'USER_NOT_FOUND', '用户不存在')
      }

      const previous = clampQuotaBytes(Number(row.cos_storage_quota_bytes))
      let next: number
      if (hasSet) {
        const n = Number(b.quotaBytes)
        if (!Number.isFinite(n)) {
          throw new AppError(400, 'BAD_INPUT', 'quotaBytes 无效')
        }
        next = clampQuotaBytes(n)
      } else {
        const add = Number(b.addQuotaBytes)
        if (!Number.isFinite(add) || add === 0) {
          throw new AppError(400, 'BAD_INPUT', 'addQuotaBytes 须为非零数字')
        }
        next = clampQuotaBytes(previous + Math.floor(add))
      }

      const delta = next - previous
      if (delta === 0) {
        throw new AppError(400, 'QUOTA_UNCHANGED', '配额未发生变化')
      }

      await quotaRepo.updateUserCosStorageQuota(conn, row.id, next)
      const now = Date.now()
      await quotaRepo.insertQuotaAdjustment(conn, {
        id: randomUUID(),
        user_id: row.id,
        operator_user_id: operatorUserId,
        previous_quota_bytes: previous,
        new_quota_bytes: next,
        delta_bytes: delta,
        remark,
        created_at: now,
      })
      await conn.commit()

      writeAppLog(
        'INFO',
        `[admin] cos quota adjusted operator=${operatorUserId} user=${row.id} ${previous}->${next} delta=${delta}`
      )

      return {
        userId: row.id,
        email: row.email,
        displayName: row.display_name,
        previousQuotaBytes: previous,
        newQuotaBytes: next,
        deltaBytes: delta,
      }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  },

  async getUserCosQuotaHistory(userId: string, limitRaw?: unknown) {
    const userIdTrim = typeof userId === 'string' ? userId.trim() : ''
    if (!userIdTrim) {
      throw new AppError(400, 'BAD_INPUT', '缺少 userId')
    }
    const pool = getPool()
    const user = await quotaRepo.findUserCosQuotaById(pool, userIdTrim)
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', '用户不存在')
    }
    const limit = typeof limitRaw === 'number' ? limitRaw : Number(limitRaw ?? 20)
    const rows = await quotaRepo.listQuotaAdjustmentsByUser(pool, userIdTrim, limit)
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      operatorUserId: r.operator_user_id,
      previousQuotaBytes: Number(r.previous_quota_bytes),
      newQuotaBytes: Number(r.new_quota_bytes),
      deltaBytes: Number(r.delta_bytes),
      remark: r.remark,
      createdAt: Number(r.created_at),
    }))
  },
}
