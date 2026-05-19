import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'

export type DbExecutor = Pick<Pool, 'execute'>

export const PARAM_INVITE_MAX_REDEMPTIONS_PER_INVITER = 'invite_max_redemptions_per_inviter'

export const DEFAULT_INVITE_MAX_REDEMPTIONS_PER_INVITER = 1

export const PARAM_INVITE_MAX_GENERATIONS_PER_DAY = 'invite_max_generations_per_day'

export const DEFAULT_INVITE_MAX_GENERATIONS_PER_DAY = 2

export const PARAM_COS_SECRET_ID = 'cos_secret_id'
export const PARAM_COS_SECRET_KEY = 'cos_secret_key'
export const PARAM_COS_REGION = 'cos_region'
export const PARAM_COS_BUCKET = 'cos_bucket'
export const PARAM_COS_KEY_PREFIX = 'cos_key_prefix'
export const PARAM_COS_UPLOAD_MAX_BYTES = 'cos_upload_max_bytes'
export const PARAM_COS_PRESIGN_PUT_EXPIRES_SEC = 'cos_presign_put_expires_sec'
export const PARAM_COS_PRESIGN_GET_EXPIRES_SEC = 'cos_presign_get_expires_sec'

export const DEFAULT_COS_UPLOAD_MAX_BYTES = 20 * 1024 * 1024
export const DEFAULT_COS_PRESIGN_PUT_EXPIRES_SEC = 900
export const DEFAULT_COS_PRESIGN_GET_EXPIRES_SEC = 600

interface IntParamRow extends RowDataPacket {
  int_value: number | null
}

interface StringParamRow extends RowDataPacket {
  string_value: string | null
}

export async function getStringParam(db: DbExecutor, key: string): Promise<string | null> {
  const [rows] = await db.execute<StringParamRow[]>(
    'SELECT string_value FROM app_parameters WHERE param_key = ? LIMIT 1',
    [key]
  )
  const v = rows[0]?.string_value
  if (v == null) return null
  const t = String(v).trim()
  return t.length ? t : null
}

export async function getIntParam(db: DbExecutor, key: string, defaultValue: number): Promise<number> {
  const [rows] = await db.execute<IntParamRow[]>(
    'SELECT int_value FROM app_parameters WHERE param_key = ? LIMIT 1',
    [key]
  )
  const row = rows[0]
  if (!row) return defaultValue
  const v = row.int_value
  if (v == null || !Number.isFinite(Number(v))) return defaultValue
  return Math.floor(Number(v))
}

export async function setStringParam(db: DbExecutor, key: string, value: string | null): Promise<void> {
  const now = Date.now()
  const stringValue = value == null || value === '' ? null : value
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE app_parameters SET value_type = 'string', string_value = ?, int_value = NULL, updated_at = ?
     WHERE param_key = ?`,
    [stringValue, now, key]
  )
  const affected = result.affectedRows ?? 0
  if (affected === 0) {
    await db.execute(
      `INSERT INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
       VALUES (?, 'string', NULL, ?, ?)`,
      [key, stringValue, now]
    )
  }
}

export async function setIntParam(db: DbExecutor, key: string, value: number): Promise<void> {
  const now = Date.now()
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE app_parameters SET value_type = 'int', int_value = ?, string_value = NULL, updated_at = ?
     WHERE param_key = ?`,
    [value, now, key]
  )
  const affected = result.affectedRows ?? 0
  if (affected === 0) {
    await db.execute(
      `INSERT INTO app_parameters (param_key, value_type, int_value, string_value, updated_at)
       VALUES (?, 'int', ?, NULL, ?)`,
      [key, value, now]
    )
  }
}

export async function getInviteMaxRedemptionsPerInviter(db: DbExecutor): Promise<number> {
  const n = await getIntParam(db, PARAM_INVITE_MAX_REDEMPTIONS_PER_INVITER, DEFAULT_INVITE_MAX_REDEMPTIONS_PER_INVITER)
  return n >= 1 ? n : DEFAULT_INVITE_MAX_REDEMPTIONS_PER_INVITER
}

export async function getInviteMaxGenerationsPerDay(db: DbExecutor): Promise<number> {
  const n = await getIntParam(db, PARAM_INVITE_MAX_GENERATIONS_PER_DAY, DEFAULT_INVITE_MAX_GENERATIONS_PER_DAY)
  return n >= 1 ? n : DEFAULT_INVITE_MAX_GENERATIONS_PER_DAY
}
