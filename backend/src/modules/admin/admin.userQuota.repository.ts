import type { RowDataPacket } from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'

export type DbExecutor = Pick<Pool, 'execute'>

export interface UserCosQuotaRow extends RowDataPacket {
  id: string
  email: string
  display_name: string
  cos_storage_quota_bytes: number
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
     LIMIT ?`,
    [userId, n]
  )
  return rows
}
