import type { RowDataPacket } from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'

export type DbExecutor = Pick<Pool, 'execute'>

export interface UserRow extends RowDataPacket {
  id: string
  email: string
  password_hash: string
  display_name: string
  avatar_url: string | null
  created_at: number
  invited_by_user_id: string | null
}

export async function findUserByEmail(db: DbExecutor, email: string): Promise<UserRow | null> {
  const [rows] = await db.execute<UserRow[]>('SELECT * FROM users WHERE email = ? LIMIT 1', [email])
  return rows[0] ?? null
}

export async function findUserById(db: DbExecutor, id: string): Promise<UserRow | null> {
  const [rows] = await db.execute<UserRow[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [id])
  return rows[0] ?? null
}

export async function insertUser(
  db: DbExecutor,
  row: {
    id: string
    email: string
    password_hash: string
    display_name: string
    avatar_url: null
    created_at: number
    invited_by_user_id: string | null
  }
): Promise<void> {
  await db.execute(
    `INSERT INTO users (id, email, password_hash, display_name, avatar_url, created_at, invited_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.email,
      row.password_hash,
      row.display_name,
      row.avatar_url,
      row.created_at,
      row.invited_by_user_id,
    ]
  )
}

interface CountRow extends RowDataPacket {
  cnt: number
}

export async function countUsers(db: DbExecutor): Promise<number> {
  const [rows] = await db.execute<CountRow[]>('SELECT COUNT(*) AS cnt FROM users')
  return Number(rows[0]?.cnt ?? 0)
}

export async function insertRefreshToken(
  db: DbExecutor,
  row: { id: string; user_id: string; token_hash: string; expires_at: number; created_at: number }
): Promise<void> {
  await db.execute(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [row.id, row.user_id, row.token_hash, row.expires_at, row.created_at]
  )
}

export async function deleteRefreshByHash(db: DbExecutor, tokenHash: string): Promise<void> {
  await db.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash])
}

interface RefreshRow extends RowDataPacket {
  id: string
  user_id: string
  expires_at: number
}

export async function findRefreshByHash(db: DbExecutor, tokenHash: string): Promise<RefreshRow | null> {
  const [rows] = await db.execute<RefreshRow[]>(
    'SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ? LIMIT 1',
    [tokenHash]
  )
  return rows[0] ?? null
}

export async function updateUserProfile(
  db: DbExecutor,
  userId: string,
  display_name: string,
  avatar_url: string | null
): Promise<void> {
  await db.execute('UPDATE users SET display_name = ?, avatar_url = ? WHERE id = ?', [
    display_name,
    avatar_url,
    userId,
  ])
}

export async function updatePasswordHash(db: DbExecutor, userId: string, password_hash: string): Promise<void> {
  await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, userId])
}

export async function deleteRefreshTokensForUser(db: DbExecutor, userId: string): Promise<void> {
  await db.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId])
}

export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'ER_DUP_ENTRY'
}
