import type { RowDataPacket } from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'

export type DbExecutor = Pick<Pool, 'execute'>

export interface UserCosQuotaRow extends RowDataPacket {
  id: string
  email: string
  display_name: string
  cos_storage_quota_bytes: number
}

export interface UserCosQuotaListRow extends RowDataPacket {
  id: string
  email: string
  display_name: string
  cos_storage_quota_bytes: number
  created_at: number
}

export type UserCosQuotaListSortBy = 'email' | 'displayName' | 'quotaBytes' | 'createdAt'

export interface UserCosQuotaListFilters {
  keyword?: string
  minQuotaBytes?: number
  maxQuotaBytes?: number
  sortBy: UserCosQuotaListSortBy
  sortOrder: 'asc' | 'desc'
  offset: number
  limit: number
}

function buildListWhere(filters: Pick<UserCosQuotaListFilters, 'keyword' | 'minQuotaBytes' | 'maxQuotaBytes'>) {
  const clauses: string[] = []
  const params: (string | number)[] = []
  const kw = filters.keyword?.trim()
  if (kw) {
    const like = `%${kw}%`
    clauses.push('(email LIKE ? OR display_name LIKE ?)')
    params.push(like, like)
  }
  if (filters.minQuotaBytes != null) {
    clauses.push('cos_storage_quota_bytes >= ?')
    params.push(filters.minQuotaBytes)
  }
  if (filters.maxQuotaBytes != null) {
    clauses.push('cos_storage_quota_bytes <= ?')
    params.push(filters.maxQuotaBytes)
  }
  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  return { whereSql, params }
}

function listOrderSql(sortBy: UserCosQuotaListSortBy, sortOrder: 'asc' | 'desc'): string {
  const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'
  const col =
    sortBy === 'displayName'
      ? 'display_name'
      : sortBy === 'quotaBytes'
        ? 'cos_storage_quota_bytes'
        : sortBy === 'createdAt'
          ? 'created_at'
          : 'email'
  return `ORDER BY ${col} ${dir}`
}

export interface QuotaAdjustmentRow extends RowDataPacket {
  id: string
  user_id: string
  operator_user_id: string | null
  previous_quota_bytes: number
  new_quota_bytes: number
  delta_bytes: number
  remark: string | null
  created_at: number
}

export async function countUsersCosQuota(
  db: DbExecutor,
  filters: Pick<UserCosQuotaListFilters, 'keyword' | 'minQuotaBytes' | 'maxQuotaBytes'>
): Promise<number> {
  const { whereSql, params } = buildListWhere(filters)
  const [rows] = await db.execute<({ cnt: number } & RowDataPacket)[]>(
    `SELECT COUNT(*) AS cnt FROM users ${whereSql}`,
    params
  )
  return Number(rows[0]?.cnt ?? 0)
}

export async function listUsersCosQuota(
  db: DbExecutor,
  filters: UserCosQuotaListFilters
): Promise<UserCosQuotaListRow[]> {
  const { whereSql, params } = buildListWhere(filters)
  const orderSql = listOrderSql(filters.sortBy, filters.sortOrder)
  const offset = Math.max(0, Math.floor(filters.offset))
  const limit = Math.min(Math.max(Math.floor(filters.limit), 1), 100)
  const [rows] = await db.execute<UserCosQuotaListRow[]>(
    `SELECT id, email, display_name, cos_storage_quota_bytes, created_at
     FROM users ${whereSql}
     ${orderSql}
     LIMIT ${limit} OFFSET ${offset}`,
    params
  )
  return rows
}

export async function listAllUsersCosQuotaForUsageFilter(
  db: DbExecutor,
  filters: Pick<UserCosQuotaListFilters, 'keyword' | 'minQuotaBytes' | 'maxQuotaBytes' | 'sortBy' | 'sortOrder'>
): Promise<UserCosQuotaListRow[]> {
  const { whereSql, params } = buildListWhere(filters)
  const orderSql = listOrderSql(filters.sortBy, filters.sortOrder)
  const [rows] = await db.execute<UserCosQuotaListRow[]>(
    `SELECT id, email, display_name, cos_storage_quota_bytes, created_at
     FROM users ${whereSql}
     ${orderSql}
     LIMIT 500`,
    params
  )
  return rows
}

export async function findUserCosQuotaById(db: DbExecutor, userId: string): Promise<UserCosQuotaRow | null> {
  const [rows] = await db.execute<UserCosQuotaRow[]>(
    `SELECT id, email, display_name, cos_storage_quota_bytes
     FROM users WHERE id = ? LIMIT 1`,
    [userId]
  )
  return rows[0] ?? null
}

export async function findUserCosQuotaByEmail(db: DbExecutor, email: string): Promise<UserCosQuotaRow | null> {
  const [rows] = await db.execute<UserCosQuotaRow[]>(
    `SELECT id, email, display_name, cos_storage_quota_bytes
     FROM users WHERE email = ? LIMIT 1`,
    [email]
  )
  return rows[0] ?? null
}

export async function updateUserCosStorageQuota(
  db: DbExecutor,
  userId: string,
  quotaBytes: number
): Promise<void> {
  await db.execute('UPDATE users SET cos_storage_quota_bytes = ? WHERE id = ?', [quotaBytes, userId])
}

export async function insertQuotaAdjustment(
  db: DbExecutor,
  row: {
    id: string
    user_id: string
    operator_user_id: string | null
    previous_quota_bytes: number
    new_quota_bytes: number
    delta_bytes: number
    remark: string | null
    created_at: number
  }
): Promise<void> {
  await db.execute(
    `INSERT INTO user_cos_quota_adjustments
     (id, user_id, operator_user_id, previous_quota_bytes, new_quota_bytes, delta_bytes, remark, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      row.operator_user_id,
      row.previous_quota_bytes,
      row.new_quota_bytes,
      row.delta_bytes,
      row.remark,
      row.created_at,
    ]
  )
}

export async function listQuotaAdjustmentsByUser(
  db: DbExecutor,
  userId: string,
  limit: number
): Promise<QuotaAdjustmentRow[]> {
  const n = Math.min(Math.max(Math.floor(limit), 1), 100)
  const [rows] = await db.execute<QuotaAdjustmentRow[]>(
    `SELECT id, user_id, operator_user_id, previous_quota_bytes, new_quota_bytes, delta_bytes, remark, created_at
     FROM user_cos_quota_adjustments
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ${n}`,
    [userId]
  )
  return rows
}
