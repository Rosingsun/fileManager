import type { RowDataPacket } from 'mysql2/promise'
import type { Pool, PoolConnection } from 'mysql2/promise'

export type DbConn = Pool | PoolConnection

export interface CosObjectMetaRow extends RowDataPacket {
  id: string
  owner_user_id: string
  cos_key: string
  content_category: string | null
  quality_pass: number | null
  quality_issues_json: string | null
  exif_capture_at: number | null
  created_at: number
  updated_at: number
}

export async function upsertCosObjectMeta(
  conn: DbConn,
  row: {
    id: string
    owner_user_id: string
    cos_key: string
    content_category: string | null
    quality_pass: number | null
    quality_issues_json: string | null
    exif_capture_at: number | null
    created_at: number
    updated_at: number
  }
): Promise<void> {
  await conn.execute(
    `INSERT INTO cos_object_meta (
      id, owner_user_id, cos_key, content_category, quality_pass, quality_issues_json, exif_capture_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      content_category = VALUES(content_category),
      quality_pass = VALUES(quality_pass),
      quality_issues_json = VALUES(quality_issues_json),
      exif_capture_at = VALUES(exif_capture_at),
      updated_at = VALUES(updated_at)`,
    [
      row.id,
      row.owner_user_id,
      row.cos_key,
      row.content_category,
      row.quality_pass,
      row.quality_issues_json,
      row.exif_capture_at,
      row.created_at,
      row.updated_at,
    ]
  )
}

export async function listCosObjectMetaByPrefix(
  db: DbConn,
  ownerUserId: string,
  prefix: string
): Promise<CosObjectMetaRow[]> {
  const [rows] = await db.execute<CosObjectMetaRow[]>(
    `SELECT * FROM cos_object_meta
     WHERE owner_user_id = ? AND cos_key LIKE CONCAT(?, '%')`,
    [ownerUserId, prefix.replace(/^\/+/, '')]
  )
  return rows
}

export async function getCosObjectMetaMapByKeys(
  db: DbConn,
  ownerUserId: string,
  keys: string[]
): Promise<Map<string, CosObjectMetaRow>> {
  if (keys.length === 0) return new Map()
  const map = new Map<string, CosObjectMetaRow>()
  const chunk = 50
  for (let i = 0; i < keys.length; i += chunk) {
    const slice = keys.slice(i, i + chunk)
    const placeholders = slice.map(() => '?').join(',')
    const [rows] = await db.execute<CosObjectMetaRow[]>(
      `SELECT * FROM cos_object_meta WHERE owner_user_id = ? AND cos_key IN (${placeholders})`,
      [ownerUserId, ...slice]
    )
    for (const r of rows) map.set(r.cos_key, r)
  }
  return map
}
