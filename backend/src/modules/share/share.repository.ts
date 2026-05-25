import type { RowDataPacket } from 'mysql2/promise'
import type { Pool, PoolConnection } from 'mysql2/promise'

export type DbConn = Pool | PoolConnection

/** mysql2 预编译对 LIMIT/OFFSET 占位符不友好，改用已校验的整型内联 */
function paginationSql(limit: number, offset: number): string {
  const lim = Math.max(1, Math.min(Math.floor(Number(limit)) || 1, 100))
  const off = Math.max(0, Math.floor(Number(offset)) || 0)
  return `LIMIT ${lim} OFFSET ${off}`
}

export type ShareResourceType = 'file' | 'folder'
export type SharePermission = 'read' | 'download'

export interface CosShareRow extends RowDataPacket {
  id: string
  token: string
  owner_user_id: string
  resource_type: ShareResourceType
  cos_key: string | null
  cos_prefix: string | null
  display_name: string
  permission: SharePermission
  selection_enabled: number
  expires_at: number | null
  revoked_at: number | null
  access_count: number
  last_accessed_at: number | null
  created_at: number
  updated_at: number
}

export interface SelectionSubmissionRow extends RowDataPacket {
  id: string
  share_id: string
  picker_client_id: string
  picker_label: string | null
  item_count: number
  created_at: number
}

export interface SelectionSummaryRow extends RowDataPacket {
  cos_key: string
  pick_count: number
  last_submitted_at: number
}

export interface SelectionItemRow extends RowDataPacket {
  cos_key: string
}

export async function insertCosShare(
  conn: DbConn,
  row: {
    id: string
    token: string
    owner_user_id: string
    resource_type: ShareResourceType
    cos_key: string | null
    cos_prefix: string | null
    display_name: string
    permission: SharePermission
    selection_enabled: boolean
    expires_at: number | null
    created_at: number
    updated_at: number
  }
): Promise<void> {
  await conn.execute(
    `INSERT INTO cos_shares (
      id, token, owner_user_id, resource_type, cos_key, cos_prefix, display_name,
      permission, selection_enabled, expires_at, revoked_at, access_count, last_accessed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)`,
    [
      row.id,
      row.token,
      row.owner_user_id,
      row.resource_type,
      row.cos_key,
      row.cos_prefix,
      row.display_name,
      row.permission,
      row.selection_enabled ? 1 : 0,
      row.expires_at,
      row.created_at,
      row.updated_at,
    ]
  )
}

export async function findCosShareByToken(db: DbConn, token: string): Promise<CosShareRow | null> {
  const [rows] = await db.execute<CosShareRow[]>(
    'SELECT * FROM cos_shares WHERE token = ? LIMIT 1',
    [token]
  )
  return rows[0] ?? null
}

export async function findCosShareById(db: DbConn, shareId: string): Promise<CosShareRow | null> {
  const [rows] = await db.execute<CosShareRow[]>(
    'SELECT * FROM cos_shares WHERE id = ? LIMIT 1',
    [shareId]
  )
  return rows[0] ?? null
}

export async function findCosShareByIdForOwner(
  db: DbConn,
  shareId: string,
  ownerUserId: string
): Promise<CosShareRow | null> {
  const [rows] = await db.execute<CosShareRow[]>(
    'SELECT * FROM cos_shares WHERE id = ? AND owner_user_id = ? LIMIT 1',
    [shareId, ownerUserId]
  )
  return rows[0] ?? null
}

export async function listActiveSelectionSharesByFolderPrefix(
  db: DbConn,
  ownerUserId: string,
  folderKey: string,
  now: number
): Promise<CosShareRow[]> {
  const [rows] = await db.execute<CosShareRow[]>(
    `SELECT * FROM cos_shares
     WHERE owner_user_id = ?
       AND resource_type = 'folder'
       AND cos_prefix IS NOT NULL
       AND ? LIKE CONCAT(cos_prefix, '%')
       AND selection_enabled = 1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > ?)
     ORDER BY CHAR_LENGTH(cos_prefix) DESC, created_at DESC`,
    [ownerUserId, folderKey, now]
  )
  return rows
}

export async function revokeCosShareById(conn: DbConn, shareId: string, ownerUserId: string, now: number): Promise<boolean> {
  const [result] = await conn.execute(
    'UPDATE cos_shares SET revoked_at = ?, updated_at = ? WHERE id = ? AND owner_user_id = ? AND revoked_at IS NULL',
    [now, now, shareId, ownerUserId]
  )
  return (result as { affectedRows?: number }).affectedRows === 1
}

interface CountRow extends RowDataPacket {
  c: number
}

export async function countCosSharesByOwner(db: DbConn, ownerUserId: string): Promise<number> {
  const [rows] = await db.execute<CountRow[]>(
    'SELECT COUNT(*) AS c FROM cos_shares WHERE owner_user_id = ?',
    [ownerUserId]
  )
  return Number(rows[0]?.c ?? 0)
}

export async function listCosSharesByOwner(
  db: DbConn,
  ownerUserId: string,
  limit: number,
  offset: number
): Promise<CosShareRow[]> {
  const [rows] = await db.execute<CosShareRow[]>(
    `SELECT * FROM cos_shares WHERE owner_user_id = ?
     ORDER BY created_at DESC ${paginationSql(limit, offset)}`,
    [ownerUserId]
  )
  return rows
}

export async function incrementCosShareAccess(db: DbConn, shareId: string, now: number): Promise<void> {
  await db.execute(
    'UPDATE cos_shares SET access_count = access_count + 1, last_accessed_at = ?, updated_at = ? WHERE id = ?',
    [now, now, shareId]
  )
}

export async function insertSelectionSubmission(
  conn: DbConn,
  row: {
    id: string
    share_id: string
    picker_client_id: string
    picker_label: string | null
    item_count: number
    created_at: number
  }
): Promise<void> {
  await conn.execute(
    `INSERT INTO cos_share_selection_submissions (id, share_id, picker_client_id, picker_label, item_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, row.share_id, row.picker_client_id, row.picker_label, row.item_count, row.created_at]
  )
}

export async function insertSelectionItems(
  conn: DbConn,
  rows: { id: string; submission_id: string; share_id: string; cos_key: string; created_at: number }[]
): Promise<void> {
  for (const row of rows) {
    await conn.execute(
      `INSERT INTO cos_share_selection_items (id, submission_id, share_id, cos_key, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [row.id, row.submission_id, row.share_id, row.cos_key, row.created_at]
    )
  }
}

export async function listSelectionSummaryByShareId(db: DbConn, shareId: string): Promise<SelectionSummaryRow[]> {
  const [rows] = await db.execute<SelectionSummaryRow[]>(
    `SELECT cos_key,
            COUNT(DISTINCT submission_id) AS pick_count,
            MAX(created_at) AS last_submitted_at
     FROM cos_share_selection_items
     WHERE share_id = ?
     GROUP BY cos_key
     ORDER BY last_submitted_at DESC`,
    [shareId]
  )
  return rows
}

export async function countSelectionSubmissionsByShareId(db: DbConn, shareId: string): Promise<number> {
  const [rows] = await db.execute<CountRow[]>(
    'SELECT COUNT(*) AS c FROM cos_share_selection_submissions WHERE share_id = ?',
    [shareId]
  )
  return Number(rows[0]?.c ?? 0)
}

export async function listSelectionSubmissionsByShareId(
  db: DbConn,
  shareId: string,
  limit: number,
  offset: number
): Promise<SelectionSubmissionRow[]> {
  const [rows] = await db.execute<SelectionSubmissionRow[]>(
    `SELECT * FROM cos_share_selection_submissions
     WHERE share_id = ?
     ORDER BY created_at DESC
     ${paginationSql(limit, offset)}`,
    [shareId]
  )
  return rows
}

export async function listSelectionKeysBySubmissionId(db: DbConn, submissionId: string): Promise<string[]> {
  const [rows] = await db.execute<SelectionItemRow[]>(
    'SELECT cos_key FROM cos_share_selection_items WHERE submission_id = ? ORDER BY cos_key',
    [submissionId]
  )
  return rows.map((r) => r.cos_key)
}
