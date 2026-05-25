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

export type ShareAssetVariant = 'original' | 'edited'
export type SelectionTier = 'must' | 'maybe' | 'reject'

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
  selection_round?: number
  recommended_keys_json?: string | null
  asset_variant?: string
  hide_quality_failed?: number
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
  selection_round?: number
  item_count: number
  created_at: number
}

export interface SelectionSummaryRow extends RowDataPacket {
  cos_key: string
  pick_count: number
  must_count: number
  maybe_count: number
  reject_count: number
  last_submitted_at: number
}

export interface SelectionItemDetailRow extends RowDataPacket {
  cos_key: string
  tier: string
  note: string | null
}

export interface PendingSelectionShareRow extends RowDataPacket {
  share_id: string
  token: string
  display_name: string
  cos_prefix: string | null
  submission_count: number
  latest_submission_at: number
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
    selection_round: number
    recommended_keys_json: string | null
    asset_variant: ShareAssetVariant
    hide_quality_failed: boolean
    expires_at: number | null
    created_at: number
    updated_at: number
  }
): Promise<void> {
  await conn.execute(
    `INSERT INTO cos_shares (
      id, token, owner_user_id, resource_type, cos_key, cos_prefix, display_name,
      permission, selection_enabled, selection_round, recommended_keys_json, asset_variant, hide_quality_failed,
      expires_at, revoked_at, access_count, last_accessed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)`,
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
      row.selection_round,
      row.recommended_keys_json,
      row.asset_variant,
      row.hide_quality_failed ? 1 : 0,
      row.expires_at,
      row.created_at,
      row.updated_at,
    ]
  )
}

export async function updateCosShareMeta(
  conn: DbConn,
  shareId: string,
  ownerUserId: string,
  patch: {
    selection_round?: number
    recommended_keys_json?: string | null
    asset_variant?: ShareAssetVariant
    hide_quality_failed?: boolean
    updated_at: number
  }
): Promise<boolean> {
  const sets: string[] = ['updated_at = ?']
  const vals: (string | number | null)[] = [patch.updated_at]
  if (patch.selection_round != null) {
    sets.push('selection_round = ?')
    vals.push(patch.selection_round)
  }
  if (patch.recommended_keys_json !== undefined) {
    sets.push('recommended_keys_json = ?')
    vals.push(patch.recommended_keys_json)
  }
  if (patch.asset_variant != null) {
    sets.push('asset_variant = ?')
    vals.push(patch.asset_variant)
  }
  if (patch.hide_quality_failed != null) {
    sets.push('hide_quality_failed = ?')
    vals.push(patch.hide_quality_failed ? 1 : 0)
  }
  vals.push(shareId, ownerUserId)
  const [result] = await conn.execute(
    `UPDATE cos_shares SET ${sets.join(', ')} WHERE id = ? AND owner_user_id = ?`,
    vals
  )
  return (result as { affectedRows?: number }).affectedRows === 1
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
    selection_round: number
    item_count: number
    created_at: number
  }
): Promise<void> {
  await conn.execute(
    `INSERT INTO cos_share_selection_submissions (id, share_id, picker_client_id, picker_label, selection_round, item_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.share_id,
      row.picker_client_id,
      row.picker_label,
      row.selection_round,
      row.item_count,
      row.created_at,
    ]
  )
}

export async function insertSelectionItems(
  conn: DbConn,
  rows: {
    id: string
    submission_id: string
    share_id: string
    cos_key: string
    tier: SelectionTier
    note: string | null
    created_at: number
  }[]
): Promise<void> {
  for (const row of rows) {
    await conn.execute(
      `INSERT INTO cos_share_selection_items (id, submission_id, share_id, cos_key, tier, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.submission_id, row.share_id, row.cos_key, row.tier, row.note, row.created_at]
    )
  }
}

export async function listSelectionSummaryByShareId(db: DbConn, shareId: string): Promise<SelectionSummaryRow[]> {
  const [rows] = await db.execute<SelectionSummaryRow[]>(
    `SELECT cos_key,
            COUNT(DISTINCT submission_id) AS pick_count,
            SUM(CASE WHEN tier = 'must' THEN 1 ELSE 0 END) AS must_count,
            SUM(CASE WHEN tier = 'maybe' THEN 1 ELSE 0 END) AS maybe_count,
            SUM(CASE WHEN tier = 'reject' THEN 1 ELSE 0 END) AS reject_count,
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

export async function listSelectionItemsBySubmissionId(
  db: DbConn,
  submissionId: string
): Promise<SelectionItemDetailRow[]> {
  const [rows] = await db.execute<SelectionItemDetailRow[]>(
    'SELECT cos_key, tier, note FROM cos_share_selection_items WHERE submission_id = ? ORDER BY cos_key',
    [submissionId]
  )
  return rows
}

export async function listSelectionKeysByRound(
  db: DbConn,
  shareId: string,
  round: number
): Promise<string[]> {
  const [rows] = await db.execute<SelectionItemDetailRow[]>(
    `SELECT i.cos_key FROM cos_share_selection_items i
     INNER JOIN cos_share_selection_submissions s ON s.id = i.submission_id
     WHERE i.share_id = ? AND s.selection_round = ?
     ORDER BY i.cos_key`,
    [shareId, round]
  )
  return rows.map((r) => r.cos_key)
}

export async function listPendingSelectionShares(
  db: DbConn,
  ownerUserId: string,
  sinceMs: number,
  now: number
): Promise<PendingSelectionShareRow[]> {
  const [rows] = await db.execute<PendingSelectionShareRow[]>(
    `SELECT sh.id AS share_id, sh.token, sh.display_name, sh.cos_prefix,
            COUNT(sub.id) AS submission_count,
            MAX(sub.created_at) AS latest_submission_at
     FROM cos_shares sh
     INNER JOIN cos_share_selection_submissions sub ON sub.share_id = sh.id
     WHERE sh.owner_user_id = ?
       AND sh.selection_enabled = 1
       AND sh.revoked_at IS NULL
       AND (sh.expires_at IS NULL OR sh.expires_at > ?)
       AND sub.created_at >= ?
     GROUP BY sh.id, sh.token, sh.display_name, sh.cos_prefix
     ORDER BY latest_submission_at DESC
     LIMIT 50`,
    [ownerUserId, now, sinceMs]
  )
  return rows
}

export async function remapSelectionCosKeys(
  conn: DbConn,
  shareId: string,
  mappings: { fromKey: string; toKey: string }[]
): Promise<number> {
  let updated = 0
  for (const { fromKey, toKey } of mappings) {
    if (!fromKey || !toKey || fromKey === toKey) continue
    const [result] = await conn.execute(
      `UPDATE cos_share_selection_items SET cos_key = ? WHERE share_id = ? AND cos_key = ?`,
      [toKey, shareId, fromKey]
    )
    updated += Number((result as { affectedRows?: number }).affectedRows ?? 0)
  }
  return updated
}

export async function listSelectionNotesByShareId(
  db: DbConn,
  shareId: string
): Promise<SelectionItemDetailRow[]> {
  const [rows] = await db.execute<SelectionItemDetailRow[]>(
    `SELECT cos_key, tier, note FROM cos_share_selection_items
     WHERE share_id = ? AND note IS NOT NULL AND TRIM(note) != ''`,
    [shareId]
  )
  return rows
}

export async function getLatestSubmissionAt(db: DbConn, shareId: string): Promise<number | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT MAX(created_at) AS t FROM cos_share_selection_submissions WHERE share_id = ?',
    [shareId]
  )
  const t = rows[0]?.t
  return t != null ? Number(t) : null
}
