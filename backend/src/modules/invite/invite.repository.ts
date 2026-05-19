import type { RowDataPacket } from 'mysql2/promise'
import type { Pool, PoolConnection } from 'mysql2/promise'

export type DbConn = Pool | PoolConnection

export interface InviteCodeRow extends RowDataPacket {
  id: string
  code_hash: string
  invite_plain: string | null
  inviter_user_id: string
  note: string | null
  created_at: number
  expires_at: number | null
  max_uses: number
  used_count: number
  revoked_at: number | null
}

export async function lockInviteCodeByHash(conn: DbConn, codeHash: string): Promise<InviteCodeRow | null> {
  const [rows] = await conn.execute<InviteCodeRow[]>(
    'SELECT * FROM invite_codes WHERE code_hash = ? FOR UPDATE',
    [codeHash]
  )
  return rows[0] ?? null
}

export async function insertInviteCode(
  conn: DbConn,
  row: {
    id: string
    code_hash: string
    invite_plain: string
    inviter_user_id: string
    note: string | null
    created_at: number
    expires_at: number | null
    max_uses: number
  }
): Promise<void> {
  await conn.execute(
    `INSERT INTO invite_codes (id, code_hash, invite_plain, inviter_user_id, note, created_at, expires_at, max_uses, used_count, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    [
      row.id,
      row.code_hash,
      row.invite_plain,
      row.inviter_user_id,
      row.note,
      row.created_at,
      row.expires_at,
      row.max_uses,
    ]
  )
}

export async function incrementInviteUsedCount(conn: DbConn, inviteCodeId: string): Promise<void> {
  await conn.execute('UPDATE invite_codes SET used_count = used_count + 1 WHERE id = ?', [inviteCodeId])
}

export async function revokeActiveInvitesByInviter(
  conn: DbConn,
  inviterUserId: string,
  revokedAt: number
): Promise<void> {
  await conn.execute(
    'UPDATE invite_codes SET revoked_at = ? WHERE inviter_user_id = ? AND revoked_at IS NULL',
    [revokedAt, inviterUserId]
  )
}

interface CountRedemptionsRow extends RowDataPacket {
  cnt: number
}

export async function countRedemptionsByInviter(conn: DbConn, inviterUserId: string): Promise<number> {
  const [rows] = await conn.execute<CountRedemptionsRow[]>(
    'SELECT COUNT(*) AS cnt FROM invite_redemptions WHERE inviter_user_id = ?',
    [inviterUserId]
  )
  return Number(rows[0]?.cnt ?? 0)
}

interface CountSinceRow extends RowDataPacket {
  cnt: number
}

export async function countInviteCodesCreatedSince(
  conn: DbConn,
  inviterUserId: string,
  createdAtMinInclusive: number
): Promise<number> {
  const [rows] = await conn.execute<CountSinceRow[]>(
    'SELECT COUNT(*) AS cnt FROM invite_codes WHERE inviter_user_id = ? AND created_at >= ?',
    [inviterUserId, createdAtMinInclusive]
  )
  return Number(rows[0]?.cnt ?? 0)
}

export async function insertRedemption(
  conn: DbConn,
  row: {
    id: string
    invite_code_id: string
    inviter_user_id: string
    invitee_user_id: string
    invitee_email_snapshot: string
    redeemed_at: number
  }
): Promise<void> {
  await conn.execute(
    `INSERT INTO invite_redemptions (id, invite_code_id, inviter_user_id, invitee_user_id, invitee_email_snapshot, redeemed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.invite_code_id,
      row.inviter_user_id,
      row.invitee_user_id,
      row.invitee_email_snapshot,
      row.redeemed_at,
    ]
  )
}

interface IssuedRow extends RowDataPacket {
  id: string
  invite_plain: string | null
  created_at: number
  expires_at: number | null
  max_uses: number
  used_count: number
  revoked_at: number | null
  note: string | null
}

export async function listInviteCodesByInviter(db: DbConn, inviterUserId: string): Promise<IssuedRow[]> {
  const [rows] = await db.execute<IssuedRow[]>(
    `SELECT id, invite_plain, created_at, expires_at, max_uses, used_count, revoked_at, note
     FROM invite_codes WHERE inviter_user_id = ? ORDER BY created_at DESC`,
    [inviterUserId]
  )
  return rows
}

interface RedemptionListRow extends RowDataPacket {
  id: string
  invite_code_id: string
  invitee_user_id: string
  invitee_email_snapshot: string
  redeemed_at: number
}

export async function listRedemptionsByInviter(db: DbConn, inviterUserId: string): Promise<RedemptionListRow[]> {
  const [rows] = await db.execute<RedemptionListRow[]>(
    `SELECT id, invite_code_id, invitee_user_id, invitee_email_snapshot, redeemed_at
     FROM invite_redemptions WHERE inviter_user_id = ? ORDER BY redeemed_at DESC`,
    [inviterUserId]
  )
  return rows
}
