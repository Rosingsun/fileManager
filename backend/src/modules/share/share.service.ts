import { randomBytes, randomUUID } from 'node:crypto'
import { getPool } from '../../db/pool.js'
import { AppError } from '../../utils/AppError.js'
import * as authRepo from '../auth/auth.repository.js'
import {
  assertFullKeyUnderUser,
  browseAbsolutePrefix,
  objectExists,
  presignGetForKey,
  type CosPresignGetVariant,
} from '../cos/cos.service.js'
import * as shareRepo from './share.repository.js'
import type { CosShareRow, SharePermission, ShareResourceType } from './share.repository.js'

const TOKEN_BYTES = 16
const DEFAULT_EXPIRES_HOURS = 168
const MAX_EXPIRES_HOURS = 720
const MAX_SELECTION_KEYS_PER_SUBMIT = 200
const PICKER_LABEL_MAX_LEN = 64

function generateShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex')
}

function assertShareTokenFormat(token: string): string {
  const t = token.trim()
  if (!/^[a-f0-9]{32}$/i.test(t)) {
    throw new AppError(400, 'INVALID_SHARE_TOKEN', '分享链接无效')
  }
  return t.toLowerCase()
}

function assertNotSensitiveSharePath(keyOrPrefix: string): void {
  const normalized = keyOrPrefix.trim().replace(/^\/+/, '')
  if (normalized.includes('/avatars/')) {
    throw new AppError(400, 'BAD_INPUT', '头像目录不可分享')
  }
}

function basenameFromKey(key: string): string {
  const t = key.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  const seg = t.split('/').filter(Boolean)
  return seg.length ? seg[seg.length - 1]! : '未命名'
}

function normalizeFolderPrefix(prefix: string): string {
  const k = prefix.trim().replace(/^\/+/, '')
  if (!k.endsWith('/')) {
    throw new AppError(400, 'BAD_INPUT', '文件夹路径须以 / 结尾')
  }
  return k
}

function resolveExpiresAt(expiresInHoursRaw: unknown): number | null {
  if (expiresInHoursRaw === null || expiresInHoursRaw === undefined) {
    return Date.now() + DEFAULT_EXPIRES_HOURS * 3600 * 1000
  }
  if (typeof expiresInHoursRaw !== 'number' || !Number.isFinite(expiresInHoursRaw)) {
    throw new AppError(400, 'BAD_INPUT', 'expiresInHours 不合法')
  }
  if (expiresInHoursRaw <= 0) return null
  const hours = Math.min(Math.max(Math.floor(expiresInHoursRaw), 1), MAX_EXPIRES_HOURS)
  return Date.now() + hours * 3600 * 1000
}

function parsePermission(raw: unknown): SharePermission {
  if (raw === 'download') return 'download'
  if (raw === 'read' || raw === undefined || raw === null) return 'read'
  throw new AppError(400, 'BAD_INPUT', 'permission 须为 read 或 download')
}

function parseResourceType(raw: unknown): ShareResourceType {
  if (raw === 'file' || raw === 'folder') return raw
  throw new AppError(400, 'BAD_INPUT', 'resourceType 须为 file 或 folder')
}

function parseSelectionEnabled(raw: unknown, resourceType: ShareResourceType): boolean {
  if (raw === true || raw === 1 || raw === 'true') {
    if (resourceType !== 'folder') {
      throw new AppError(400, 'BAD_INPUT', '仅文件夹分享可开启选片反馈')
    }
    return true
  }
  if (raw === false || raw === 0 || raw === 'false' || raw === undefined || raw === null) {
    return false
  }
  throw new AppError(400, 'BAD_INPUT', 'selectionEnabled 须为 boolean')
}

function parsePickerClientId(raw: unknown): string {
  const id = typeof raw === 'string' ? raw.trim() : ''
  if (!/^[a-f0-9-]{36}$/i.test(id)) {
    throw new AppError(400, 'BAD_INPUT', 'pickerClientId 不合法')
  }
  return id.toLowerCase()
}

function normalizePickerLabel(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'string') throw new AppError(400, 'BAD_INPUT', 'pickerLabel 不合法')
  const t = raw.trim()
  if (!t) return null
  return t.slice(0, PICKER_LABEL_MAX_LEN)
}

function parseSelectionKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new AppError(400, 'BAD_INPUT', 'keys 须为数组')
  const keys = raw
    .filter((k): k is string => typeof k === 'string')
    .map((k) => k.trim().replace(/^\/+/, ''))
    .filter(Boolean)
  const unique = [...new Set(keys)]
  if (unique.length === 0) throw new AppError(400, 'BAD_INPUT', '请至少选择一张图片')
  if (unique.length > MAX_SELECTION_KEYS_PER_SUBMIT) {
    throw new AppError(400, 'SELECTION_LIMIT_EXCEEDED', `单次最多提交 ${MAX_SELECTION_KEYS_PER_SUBMIT} 张图片`)
  }
  return unique
}

function rowSelectionEnabled(row: CosShareRow): boolean {
  return Number(row.selection_enabled) === 1
}

function isShareActive(row: CosShareRow, now = Date.now()): boolean {
  if (row.revoked_at != null) return false
  if (row.expires_at != null && row.expires_at <= now) return false
  return true
}

function maskOwnerDisplayName(name: string): string {
  const t = name.trim()
  if (!t) return '用户'
  if (t.length <= 1) return `${t}*`
  return `${t.slice(0, 1)}${'*'.repeat(Math.min(t.length - 1, 3))}`
}

function toShareItem(row: CosShareRow) {
  const now = Date.now()
  const active = isShareActive(row, now)
  return {
    id: row.id,
    token: row.token,
    resourceType: row.resource_type,
    cosKey: row.cos_key,
    cosPrefix: row.cos_prefix,
    displayName: row.display_name,
    permission: row.permission,
    selectionEnabled: rowSelectionEnabled(row),
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    active,
    accessCount: row.access_count,
    lastAccessedAt: row.last_accessed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function loadActiveShare(token: string): Promise<CosShareRow> {
  const normalized = assertShareTokenFormat(token)
  const row = await shareRepo.findCosShareByToken(getPool(), normalized)
  if (!row) throw new AppError(404, 'SHARE_NOT_FOUND', '分享不存在或已失效')
  if (row.revoked_at != null) throw new AppError(404, 'SHARE_NOT_FOUND', '分享不存在或已失效')
  if (row.expires_at != null && row.expires_at <= Date.now()) {
    throw new AppError(404, 'SHARE_NOT_FOUND', '分享不存在或已失效')
  }
  return row
}

function assertKeyWithinShare(row: CosShareRow, key: string): void {
  const normalized = key.trim().replace(/^\/+/, '')
  if (row.resource_type === 'file') {
    const fileKey = row.cos_key?.trim().replace(/^\/+/, '') ?? ''
    if (normalized !== fileKey) {
      throw new AppError(403, 'FORBIDDEN', '无权访问该对象')
    }
    return
  }
  const prefix = row.cos_prefix?.trim().replace(/^\/+/, '') ?? ''
  if (!prefix || !normalized.startsWith(prefix)) {
    throw new AppError(403, 'FORBIDDEN', '无权访问该对象')
  }
  assertFullKeyUnderUser(row.owner_user_id, normalized)
}

export const shareService = {
  async create(
    userId: string,
    body: {
      resourceType?: unknown
      key?: unknown
      prefix?: unknown
      permission?: unknown
      expiresInHours?: unknown
      selectionEnabled?: unknown
    }
  ) {
    const resourceType = parseResourceType(body.resourceType)
    const permission = parsePermission(body.permission)
    const selectionEnabled = parseSelectionEnabled(body.selectionEnabled, resourceType)
    const expiresAt = resolveExpiresAt(body.expiresInHours)
    const now = Date.now()

    let cosKey: string | null = null
    let cosPrefix: string | null = null
    let displayName = '未命名'

    if (resourceType === 'file') {
      const key = typeof body.key === 'string' ? body.key.trim() : ''
      if (!key) throw new AppError(400, 'BAD_INPUT', '缺少 key')
      assertFullKeyUnderUser(userId, key)
      assertNotSensitiveSharePath(key)
      if (key.endsWith('/')) throw new AppError(400, 'BAD_INPUT', '文件 key 不能以 / 结尾')
      if (!(await objectExists(key))) throw new AppError(404, 'NOT_FOUND', '文件不存在')
      cosKey = key.replace(/^\/+/, '')
      displayName = basenameFromKey(cosKey)
    } else {
      const prefix = typeof body.prefix === 'string' ? normalizeFolderPrefix(body.prefix) : ''
      if (!prefix) throw new AppError(400, 'BAD_INPUT', '缺少 prefix')
      assertFullKeyUnderUser(userId, prefix)
      assertNotSensitiveSharePath(prefix)
      if (!(await objectExists(prefix))) throw new AppError(404, 'NOT_FOUND', '文件夹不存在')
      cosPrefix = prefix
      displayName = basenameFromKey(prefix.replace(/\/$/, '')) || '文件夹'
    }

    const id = randomUUID()
    const token = generateShareToken()
    await shareRepo.insertCosShare(getPool(), {
      id,
      token,
      owner_user_id: userId,
      resource_type: resourceType,
      cos_key: cosKey,
      cos_prefix: cosPrefix,
      display_name: displayName,
      permission,
      selection_enabled: selectionEnabled,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    })

    return {
      id,
      token,
      resourceType,
      cosKey,
      cosPrefix,
      displayName,
      permission,
      selectionEnabled,
      expiresAt,
      revokedAt: null,
      active: true,
      accessCount: 0,
      lastAccessedAt: null,
      createdAt: now,
      updatedAt: now,
      sharePath: `/share/${token}`,
    }
  },

  async revoke(userId: string, body: { shareId?: unknown; token?: unknown }) {
    const shareId = typeof body.shareId === 'string' ? body.shareId.trim() : ''
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (!shareId && !token) throw new AppError(400, 'BAD_INPUT', '缺少 shareId 或 token')

    const pool = getPool()
    let row: CosShareRow | null = null
    if (shareId) {
      row = await shareRepo.findCosShareByIdForOwner(pool, shareId, userId)
    } else {
      const normalized = assertShareTokenFormat(token)
      const found = await shareRepo.findCosShareByToken(pool, normalized)
      if (found && found.owner_user_id === userId) row = found
    }
    if (!row) throw new AppError(404, 'SHARE_NOT_FOUND', '分享不存在')
    if (row.revoked_at != null) return null

    const ok = await shareRepo.revokeCosShareById(pool, row.id, userId, Date.now())
    if (!ok) throw new AppError(404, 'SHARE_NOT_FOUND', '分享不存在')
    return null
  },

  async listMine(userId: string, query: { page?: unknown; pageSize?: unknown }) {
    const pageRaw = typeof query.page === 'string' ? Number(query.page) : 1
    const pageSizeRaw = typeof query.pageSize === 'string' ? Number(query.pageSize) : 20
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), 100) : 20
    const offset = (page - 1) * pageSize

    const pool = getPool()
    const total = await shareRepo.countCosSharesByOwner(pool, userId)
    const rows = await shareRepo.listCosSharesByOwner(pool, userId, pageSize, offset)
    return {
      items: rows.map(toShareItem),
      total,
      page,
      pageSize,
    }
  },

  async getPublic(token: string) {
    const row = await loadActiveShare(token)
    const owner = await authRepo.findUserById(getPool(), row.owner_user_id)
    const ownerDisplayName = maskOwnerDisplayName(owner?.display_name ?? '')

    void shareRepo.incrementCosShareAccess(getPool(), row.id, Date.now()).catch(() => {})

    return {
      token: row.token,
      resourceType: row.resource_type,
      displayName: row.display_name,
      permission: row.permission,
      expiresAt: row.expires_at,
      ownerDisplayName,
      selectionEnabled: rowSelectionEnabled(row),
    }
  },

  async browsePublic(token: string, prefixRaw?: string) {
    const row = await loadActiveShare(token)
    if (row.resource_type !== 'folder') {
      throw new AppError(400, 'BAD_INPUT', '该分享不是文件夹')
    }
    const boundary = row.cos_prefix?.trim().replace(/^\/+/, '') ?? ''
    if (!boundary) throw new AppError(500, 'INTERNAL_ERROR', '分享配置异常')

    const rel = typeof prefixRaw === 'string' ? prefixRaw : ''
    const listPrefix = `${boundary}${rel.replace(/^\/+/, '')}`
    return browseAbsolutePrefix(listPrefix, boundary)
  },

  async presignPublic(
    token: string,
    body: { key?: unknown; variant?: unknown }
  ) {
    const row = await loadActiveShare(token)
    let key = typeof body.key === 'string' ? body.key.trim() : ''
    if (row.resource_type === 'file') {
      key = row.cos_key?.trim().replace(/^\/+/, '') ?? ''
    } else {
      if (!key) throw new AppError(400, 'BAD_INPUT', '缺少 key')
    }
    assertKeyWithinShare(row, key)

    const variant: CosPresignGetVariant = body.variant === 'thumb' ? 'thumb' : 'full'
    void shareRepo.incrementCosShareAccess(getPool(), row.id, Date.now()).catch(() => {})
    return presignGetForKey({ key, variant })
  },

  async submitSelection(
    token: string,
    body: { pickerClientId?: unknown; pickerLabel?: unknown; keys?: unknown }
  ) {
    const row = await loadActiveShare(token)
    if (row.resource_type !== 'folder') {
      throw new AppError(400, 'BAD_INPUT', '该分享不是文件夹')
    }
    if (!rowSelectionEnabled(row)) {
      throw new AppError(400, 'SELECTION_DISABLED', '该分享未开启选片反馈')
    }

    const pickerClientId = parsePickerClientId(body.pickerClientId)
    const pickerLabel = normalizePickerLabel(body.pickerLabel)
    const keys = parseSelectionKeys(body.keys)

    for (const key of keys) {
      if (key.endsWith('/')) {
        throw new AppError(400, 'BAD_SELECTION_KEYS', '选片 key 不能为文件夹')
      }
      assertKeyWithinShare(row, key)
    }

    const pool = getPool()
    const conn = await pool.getConnection()
    const now = Date.now()
    const submissionId = randomUUID()
    try {
      await conn.beginTransaction()
      await shareRepo.insertSelectionSubmission(conn, {
        id: submissionId,
        share_id: row.id,
        picker_client_id: pickerClientId,
        picker_label: pickerLabel,
        item_count: keys.length,
        created_at: now,
      })
      await shareRepo.insertSelectionItems(
        conn,
        keys.map((cosKey) => ({
          id: randomUUID(),
          submission_id: submissionId,
          share_id: row.id,
          cos_key: cosKey,
          created_at: now,
        }))
      )
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }

    return {
      submissionId,
      itemCount: keys.length,
      createdAt: now,
    }
  },

  async selectionSummary(userId: string, shareIdRaw: unknown) {
    const shareId = typeof shareIdRaw === 'string' ? shareIdRaw.trim() : ''
    if (!shareId) throw new AppError(400, 'BAD_INPUT', '缺少 shareId')

    const pool = getPool()
    const row = await shareRepo.findCosShareByIdForOwner(pool, shareId, userId)
    if (!row) throw new AppError(404, 'SHARE_NOT_FOUND', '分享不存在')

    const picks = await shareRepo.listSelectionSummaryByShareId(pool, shareId)
    return {
      shareId,
      picks: picks.map((p) => ({
        cosKey: p.cos_key,
        pickCount: Number(p.pick_count),
        lastSubmittedAt: Number(p.last_submitted_at),
      })),
    }
  },

  async selectionSubmissions(
    userId: string,
    query: { shareId?: unknown; page?: unknown; pageSize?: unknown }
  ) {
    const shareId = typeof query.shareId === 'string' ? query.shareId.trim() : ''
    if (!shareId) throw new AppError(400, 'BAD_INPUT', '缺少 shareId')

    const pageRaw = Number(query.page ?? 1)
    const pageSizeRaw = Number(query.pageSize ?? 20)
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), 100) : 20
    const offset = (page - 1) * pageSize

    const pool = getPool()
    const row = await shareRepo.findCosShareByIdForOwner(pool, shareId, userId)
    if (!row) throw new AppError(404, 'SHARE_NOT_FOUND', '分享不存在')

    const total = await shareRepo.countSelectionSubmissionsByShareId(pool, shareId)
    const submissions = await shareRepo.listSelectionSubmissionsByShareId(pool, shareId, pageSize, offset)

    const items = await Promise.all(
      submissions.map(async (s) => ({
        id: s.id,
        pickerClientId: s.picker_client_id,
        pickerLabel: s.picker_label,
        itemCount: s.item_count,
        createdAt: s.created_at,
        keys: await shareRepo.listSelectionKeysBySubmissionId(pool, s.id),
      }))
    )

    return { items, total, page, pageSize }
  },

  async selectionsByFolderPrefix(userId: string, folderKeyRaw: unknown) {
    const folderKey = typeof folderKeyRaw === 'string' ? normalizeFolderPrefix(folderKeyRaw) : ''
    if (!folderKey) throw new AppError(400, 'BAD_INPUT', '缺少 folderKey')
    assertFullKeyUnderUser(userId, folderKey)

    const pool = getPool()
    const now = Date.now()
    const rows = await shareRepo.listActiveSelectionSharesByFolderPrefix(pool, userId, folderKey, now)
    const shares = await Promise.all(
      rows.map(async (row) => ({
        ...toShareItem(row),
        submissionCount: await shareRepo.countSelectionSubmissionsByShareId(pool, row.id),
      }))
    )
    return { shares }
  },
}
