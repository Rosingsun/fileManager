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
import * as metaRepo from '../cos/cos-meta.repository.js'
import type {
  CosShareRow,
  SelectionTier,
  ShareAssetVariant,
  SharePermission,
  ShareResourceType,
} from './share.repository.js'

const TOKEN_BYTES = 16
const DEFAULT_EXPIRES_HOURS = 168
const MAX_EXPIRES_HOURS = 720
const MAX_SELECTION_KEYS_PER_SUBMIT = 200
const PICKER_LABEL_MAX_LEN = 64
const NOTE_MAX_LEN = 512
const VALID_TIERS: SelectionTier[] = ['must', 'maybe', 'reject']

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

function parseSelectionTier(raw: unknown): SelectionTier {
  if (raw === 'must' || raw === 'maybe' || raw === 'reject') return raw
  return 'must'
}

function parseSelectionItems(raw: unknown): { cosKey: string; tier: SelectionTier; note: string | null }[] {
  if (Array.isArray(raw) && raw.length > 0 && raw.every((x) => x && typeof x === 'object')) {
    const items = raw
      .map((x) => {
        const o = x as Record<string, unknown>
        const key = typeof o.key === 'string' ? o.key.trim().replace(/^\/+/, '') : ''
        if (!key) return null
        const tier = parseSelectionTier(o.tier)
        let note: string | null = null
        if (typeof o.note === 'string') {
          const t = o.note.trim()
          note = t ? t.slice(0, NOTE_MAX_LEN) : null
        }
        return { cosKey: key, tier, note }
      })
      .filter((x): x is { cosKey: string; tier: SelectionTier; note: string | null } => x != null)
    const seen = new Set<string>()
    const unique: { cosKey: string; tier: SelectionTier; note: string | null }[] = []
    for (const it of items) {
      if (seen.has(it.cosKey)) continue
      seen.add(it.cosKey)
      unique.push(it)
    }
    if (unique.length === 0) throw new AppError(400, 'BAD_INPUT', '请至少选择一张图片')
    if (unique.length > MAX_SELECTION_KEYS_PER_SUBMIT) {
      throw new AppError(400, 'SELECTION_LIMIT_EXCEEDED', `单次最多提交 ${MAX_SELECTION_KEYS_PER_SUBMIT} 张图片`)
    }
    return unique
  }
  return []
}

function parseSelectionKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const keys = raw
    .filter((k): k is string => typeof k === 'string')
    .map((k) => k.trim().replace(/^\/+/, ''))
    .filter(Boolean)
  return [...new Set(keys)]
}

function resolveSelectionPayload(body: {
  items?: unknown
  keys?: unknown
}): { cosKey: string; tier: SelectionTier; note: string | null }[] {
  const fromItems = parseSelectionItems(body.items)
  if (fromItems.length > 0) return fromItems
  const keys = parseSelectionKeys(body.keys)
  if (keys.length === 0) throw new AppError(400, 'BAD_INPUT', '请至少选择一张图片')
  if (keys.length > MAX_SELECTION_KEYS_PER_SUBMIT) {
    throw new AppError(400, 'SELECTION_LIMIT_EXCEEDED', `单次最多提交 ${MAX_SELECTION_KEYS_PER_SUBMIT} 张图片`)
  }
  return keys.map((cosKey) => ({ cosKey, tier: 'must' as SelectionTier, note: null }))
}

function parseSelectionRound(raw: unknown, fallback = 1): number {
  if (raw === undefined || raw === null) return fallback
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new AppError(400, 'BAD_INPUT', 'selectionRound 不合法')
  }
  const n = Math.floor(raw)
  if (n < 1 || n > 99) throw new AppError(400, 'BAD_INPUT', 'selectionRound 须在 1–99')
  return n
}

function parseAssetVariant(raw: unknown): ShareAssetVariant {
  if (raw === 'edited') return 'edited'
  if (raw === 'original' || raw === undefined || raw === null) return 'original'
  throw new AppError(400, 'BAD_INPUT', 'assetVariant 须为 original 或 edited')
}

function parseRecommendedKeys(raw: unknown, resourceType: ShareResourceType, boundaryPrefix: string): string[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) throw new AppError(400, 'BAD_INPUT', 'recommendedKeys 须为数组')
  const keys = raw
    .filter((k): k is string => typeof k === 'string')
    .map((k) => k.trim().replace(/^\/+/, ''))
    .filter((k) => k && !k.endsWith('/'))
  if (keys.length > 200) throw new AppError(400, 'BAD_INPUT', 'recommendedKeys 最多 200 项')
  if (resourceType !== 'folder') return keys.slice(0, 1)
  const prefix = boundaryPrefix.replace(/^\/+/, '')
  return keys.filter((k) => k.startsWith(prefix))
}

function parseRecommendedKeysJson(row: CosShareRow): string[] {
  const raw = row.recommended_keys_json
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

function rowSelectionRound(row: CosShareRow): number {
  const n = Number(row.selection_round ?? 1)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

function rowAssetVariant(row: CosShareRow): ShareAssetVariant {
  return row.asset_variant === 'edited' ? 'edited' : 'original'
}

function rowHideQualityFailed(row: CosShareRow): boolean {
  return Number(row.hide_quality_failed) === 1
}

function isEditedAssetKey(key: string): boolean {
  const base = basenameFromKey(key)
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  return stem.endsWith('_edited')
}

function mapBrowseKeyForVariant(key: string, variant: ShareAssetVariant): string {
  if (variant !== 'edited') return key
  if (isEditedAssetKey(key)) return key
  const base = basenameFromKey(key)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return key
  const stem = base.slice(0, dot)
  const ext = base.slice(dot)
  const dir = key.slice(0, key.length - base.length)
  return `${dir}${stem}_edited${ext}`
}

function originalKeyFromEdited(key: string): string {
  const base = basenameFromKey(key)
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return key
  const stem = base.slice(0, dot)
  const ext = base.slice(dot)
  if (!stem.endsWith('_edited')) return key
  const dir = key.slice(0, key.length - base.length)
  return `${dir}${stem.slice(0, -7)}${ext}`
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
    selectionRound: rowSelectionRound(row),
    recommendedKeys: parseRecommendedKeysJson(row),
    assetVariant: rowAssetVariant(row),
    hideQualityFailed: rowHideQualityFailed(row),
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
      selectionRound?: unknown
      recommendedKeys?: unknown
      assetVariant?: unknown
      hideQualityFailed?: unknown
    }
  ) {
    const resourceType = parseResourceType(body.resourceType)
    const permission = parsePermission(body.permission)
    const selectionEnabled = parseSelectionEnabled(body.selectionEnabled, resourceType)
    const selectionRound = parseSelectionRound(body.selectionRound, 1)
    const assetVariant = parseAssetVariant(body.assetVariant)
    const hideQualityFailed =
      body.hideQualityFailed === true || body.hideQualityFailed === 1 || body.hideQualityFailed === 'true'
    const expiresAt = resolveExpiresAt(body.expiresInHours)
    const now = Date.now()

    let cosKey: string | null = null
    let cosPrefix: string | null = null
    let displayName = '未命名'
    let boundaryPrefix = ''

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
      boundaryPrefix = prefix
      displayName = basenameFromKey(prefix.replace(/\/$/, '')) || '文件夹'
    }

    const recommendedKeys = parseRecommendedKeys(body.recommendedKeys, resourceType, boundaryPrefix)
    const recommendedKeysJson = recommendedKeys.length > 0 ? JSON.stringify(recommendedKeys) : null

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
      selection_round: selectionRound,
      recommended_keys_json: recommendedKeysJson,
      asset_variant: assetVariant,
      hide_quality_failed: hideQualityFailed,
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
      selectionRound,
      recommendedKeys,
      assetVariant,
      hideQualityFailed,
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

  async updateMeta(
    userId: string,
    body: {
      shareId?: unknown
      selectionRound?: unknown
      recommendedKeys?: unknown
      assetVariant?: unknown
      hideQualityFailed?: unknown
    }
  ) {
    const shareId = typeof body.shareId === 'string' ? body.shareId.trim() : ''
    if (!shareId) throw new AppError(400, 'BAD_INPUT', '缺少 shareId')

    const pool = getPool()
    const row = await shareRepo.findCosShareByIdForOwner(pool, shareId, userId)
    if (!row) throw new AppError(404, 'SHARE_NOT_FOUND', '分享不存在')

    const now = Date.now()
    const patch: {
      updated_at: number
      selection_round?: number
      recommended_keys_json?: string | null
      asset_variant?: shareRepo.ShareAssetVariant
      hide_quality_failed?: boolean
    } = { updated_at: now }

    if (body.selectionRound !== undefined && body.selectionRound !== null) {
      patch.selection_round = parseSelectionRound(body.selectionRound, rowSelectionRound(row))
    }
    if (body.recommendedKeys !== undefined) {
      const boundary = row.cos_prefix?.trim().replace(/^\/+/, '') ?? row.cos_key?.trim().replace(/^\/+/, '') ?? ''
      const keys = parseRecommendedKeys(body.recommendedKeys, row.resource_type, boundary ? `${boundary}/` : boundary)
      patch.recommended_keys_json = keys.length > 0 ? JSON.stringify(keys) : null
    }
    if (body.assetVariant !== undefined && body.assetVariant !== null) {
      patch.asset_variant = parseAssetVariant(body.assetVariant)
    }
    if (body.hideQualityFailed !== undefined && body.hideQualityFailed !== null) {
      patch.hide_quality_failed =
        body.hideQualityFailed === true || body.hideQualityFailed === 1 || body.hideQualityFailed === 'true'
    }

    const ok = await shareRepo.updateCosShareMeta(pool, shareId, userId, patch)
    if (!ok) throw new AppError(404, 'SHARE_NOT_FOUND', '分享不存在')

    const updated = await shareRepo.findCosShareByIdForOwner(pool, shareId, userId)
    return updated ? toShareItem(updated) : null
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
      selectionRound: rowSelectionRound(row),
      recommendedKeys: parseRecommendedKeysJson(row),
      assetVariant: rowAssetVariant(row),
      hideQualityFailed: rowHideQualityFailed(row),
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
    const data = await browseAbsolutePrefix(listPrefix, boundary)
    const variant = rowAssetVariant(row)
    const recommended = new Set(parseRecommendedKeysJson(row))

    let metaMap: Map<string, metaRepo.CosObjectMetaRow> = new Map()
    if (rowHideQualityFailed(row)) {
      const keys = data.objects.map((o) => o.key)
      metaMap = await metaRepo.getCosObjectMetaMapByKeys(getPool(), row.owner_user_id, keys)
    }

    const objects = data.objects.filter((o) => {
      const key = o.key
      if (variant === 'edited' && !isEditedAssetKey(key)) return false
      if (variant === 'original' && isEditedAssetKey(key)) return false
      if (rowHideQualityFailed(row)) {
        const meta = metaMap.get(key)
        if (meta && meta.quality_pass != null && Number(meta.quality_pass) === 0) return false
      }
      return true
    })

    return {
      ...data,
      objects: objects.map((o) => ({
        ...o,
        recommended: recommended.has(o.key),
        displayKey: variant === 'edited' ? mapBrowseKeyForVariant(o.key, 'edited') : o.key,
        originalKey: isEditedAssetKey(o.key) ? originalKeyFromEdited(o.key) : o.key,
      })),
      selectionRound: rowSelectionRound(row),
      recommendedKeys: [...recommended],
      assetVariant: variant,
    }
  },

  async presignPublic(
    token: string,
    body: { key?: unknown; variant?: unknown; originalKey?: unknown }
  ) {
    const row = await loadActiveShare(token)
    let key = typeof body.key === 'string' ? body.key.trim() : ''
    if (row.resource_type === 'file') {
      key = row.cos_key?.trim().replace(/^\/+/, '') ?? ''
    } else {
      if (!key) throw new AppError(400, 'BAD_INPUT', '缺少 key')
    }
    const resolvedKey =
      typeof body.originalKey === 'string' && body.originalKey.trim()
        ? body.originalKey.trim().replace(/^\/+/, '')
        : key
    assertKeyWithinShare(row, resolvedKey)

    const presignKey =
      rowAssetVariant(row) === 'edited' ? mapBrowseKeyForVariant(resolvedKey, 'edited') : resolvedKey

    const variant: CosPresignGetVariant = body.variant === 'thumb' ? 'thumb' : 'full'
    void shareRepo.incrementCosShareAccess(getPool(), row.id, Date.now()).catch(() => {})
    return {
      ...(await presignGetForKey({ key: presignKey, variant })),
      originalKey: resolvedKey,
      presignKey,
    }
  },

  async submitSelection(
    token: string,
    body: {
      pickerClientId?: unknown
      pickerLabel?: unknown
      keys?: unknown
      items?: unknown
      selectionRound?: unknown
    }
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
    const items = resolveSelectionPayload(body)
    const selectionRound = parseSelectionRound(body.selectionRound, rowSelectionRound(row))

    for (const { cosKey } of items) {
      if (cosKey.endsWith('/')) {
        throw new AppError(400, 'BAD_SELECTION_KEYS', '选片 key 不能为文件夹')
      }
      assertKeyWithinShare(row, cosKey)
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
        selection_round: selectionRound,
        item_count: items.length,
        created_at: now,
      })
      await shareRepo.insertSelectionItems(
        conn,
        items.map(({ cosKey, tier, note }) => ({
          id: randomUUID(),
          submission_id: submissionId,
          share_id: row.id,
          cos_key: cosKey,
          tier,
          note,
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
      itemCount: items.length,
      selectionRound,
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
    const noteRows = await shareRepo.listSelectionNotesByShareId(pool, shareId)
    const notesByKey = new Map<string, string[]>()
    for (const r of noteRows) {
      const note = r.note?.trim()
      if (!note) continue
      const arr = notesByKey.get(r.cos_key) ?? []
      if (!arr.includes(note)) arr.push(note)
      notesByKey.set(r.cos_key, arr)
    }

    return {
      shareId,
      picks: picks.map((p) => ({
        cosKey: p.cos_key,
        pickCount: Number(p.pick_count),
        mustCount: Number(p.must_count ?? 0),
        maybeCount: Number(p.maybe_count ?? 0),
        rejectCount: Number(p.reject_count ?? 0),
        lastSubmittedAt: Number(p.last_submitted_at),
        notes: notesByKey.get(p.cos_key) ?? [],
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
      submissions.map(async (s) => {
        const detail = await shareRepo.listSelectionItemsBySubmissionId(pool, s.id)
        return {
          id: s.id,
          pickerClientId: s.picker_client_id,
          pickerLabel: s.picker_label,
          selectionRound: Number(s.selection_round ?? 1),
          itemCount: s.item_count,
          createdAt: s.created_at,
          keys: detail.map((d) => d.cos_key),
          items: detail.map((d) => ({
            cosKey: d.cos_key,
            tier: (VALID_TIERS.includes(d.tier as SelectionTier) ? d.tier : 'must') as SelectionTier,
            note: d.note,
          })),
        }
      })
    )

    return { items, total, page, pageSize }
  },

  async selectionPending(userId: string, query: { sinceMs?: unknown }) {
    const sinceDefault = Date.now() - 7 * 24 * 3600 * 1000
    const sinceRaw = query.sinceMs != null ? Number(query.sinceMs) : sinceDefault
    const sinceMs = Number.isFinite(sinceRaw) ? Math.floor(sinceRaw) : sinceDefault
    const now = Date.now()
    const pool = getPool()
    const rows = await shareRepo.listPendingSelectionShares(pool, userId, sinceMs, now)
    return {
      items: rows.map((r) => ({
        shareId: r.share_id,
        token: r.token,
        displayName: r.display_name,
        cosPrefix: r.cos_prefix,
        submissionCount: Number(r.submission_count),
        latestSubmissionAt: Number(r.latest_submission_at),
      })),
    }
  },

  async remapSelectionKeys(
    userId: string,
    body: { shareId?: unknown; mappings?: unknown }
  ) {
    const shareId = typeof body.shareId === 'string' ? body.shareId.trim() : ''
    if (!shareId) throw new AppError(400, 'BAD_INPUT', '缺少 shareId')
    if (!Array.isArray(body.mappings)) throw new AppError(400, 'BAD_INPUT', 'mappings 须为数组')

    const pool = getPool()
    const row = await shareRepo.findCosShareByIdForOwner(pool, shareId, userId)
    if (!row) throw new AppError(404, 'SHARE_NOT_FOUND', '分享不存在')

    const mappings: { fromKey: string; toKey: string }[] = []
    for (const raw of body.mappings) {
      if (!raw || typeof raw !== 'object') continue
      const m = raw as Record<string, unknown>
      const fromKey = typeof m.fromKey === 'string' ? m.fromKey.trim().replace(/^\/+/, '') : ''
      const toKey = typeof m.toKey === 'string' ? m.toKey.trim().replace(/^\/+/, '') : ''
      if (!fromKey || !toKey || fromKey.endsWith('/') || toKey.endsWith('/')) continue
      assertKeyWithinShare(row, fromKey)
      assertKeyWithinShare(row, toKey)
      mappings.push({ fromKey, toKey })
    }

    if (mappings.length === 0) throw new AppError(400, 'BAD_INPUT', 'mappings 为空')

    const updated = await shareRepo.remapSelectionCosKeys(pool, shareId, mappings)
    return { updated, mappings: mappings.length }
  },

  async selectionDiff(
    userId: string,
    query: { shareId?: unknown; roundA?: unknown; roundB?: unknown }
  ) {
    const shareId = typeof query.shareId === 'string' ? query.shareId.trim() : ''
    if (!shareId) throw new AppError(400, 'BAD_INPUT', '缺少 shareId')
    const roundA = parseSelectionRound(query.roundA, 1)
    const roundB = parseSelectionRound(query.roundB, 2)

    const pool = getPool()
    const row = await shareRepo.findCosShareByIdForOwner(pool, shareId, userId)
    if (!row) throw new AppError(404, 'SHARE_NOT_FOUND', '分享不存在')

    const keysA = new Set(await shareRepo.listSelectionKeysByRound(pool, shareId, roundA))
    const keysB = new Set(await shareRepo.listSelectionKeysByRound(pool, shareId, roundB))
    const added = [...keysB].filter((k) => !keysA.has(k))
    const removed = [...keysA].filter((k) => !keysB.has(k))
    const unchanged = [...keysA].filter((k) => keysB.has(k))

    return { shareId, roundA, roundB, added, removed, unchanged }
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
