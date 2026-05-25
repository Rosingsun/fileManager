import { authFetchJson, getAuthApiBaseUrl } from './authClient'
import type { SelectionTier, ShareAssetVariant } from './shareSelection'

export type ShareResourceType = 'file' | 'folder'
export type SharePermission = 'read' | 'download'

export interface ShareItem {
  id: string
  token: string
  resourceType: ShareResourceType
  cosKey: string | null
  cosPrefix: string | null
  displayName: string
  permission: SharePermission
  selectionEnabled: boolean
  selectionRound: number
  recommendedKeys: string[]
  assetVariant: ShareAssetVariant
  hideQualityFailed: boolean
  expiresAt: number | null
  revokedAt: number | null
  active: boolean
  accessCount: number
  lastAccessedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface ShareCreateResult extends ShareItem {
  sharePath: string
}

export interface SharePublicMeta {
  token: string
  resourceType: ShareResourceType
  displayName: string
  permission: SharePermission
  expiresAt: number | null
  ownerDisplayName: string
  selectionEnabled: boolean
  selectionRound: number
  recommendedKeys: string[]
  assetVariant: ShareAssetVariant
  hideQualityFailed: boolean
}

export interface ShareBrowseObject {
  key: string
  size: number
  lastModified: string | null
  recommended?: boolean
  displayKey?: string
  originalKey?: string
}

export interface ShareBrowseResult {
  scopePrefix: string
  currentPrefix: string
  delimiter: string
  commonPrefixes: string[]
  objects: ShareBrowseObject[]
  isTruncated: boolean
  nextMarker: string | null
  selectionRound?: number
  recommendedKeys?: string[]
  assetVariant?: ShareAssetVariant
}

export type SharePresignGetVariant = 'full' | 'thumb'

export interface ShareSelectionItem {
  cosKey: string
  tier: SelectionTier
  note: string | null
}

export interface ShareSelectionPickSummary {
  cosKey: string
  pickCount: number
  mustCount: number
  maybeCount: number
  rejectCount: number
  lastSubmittedAt: number
  notes: string[]
}

export interface ShareSelectionSubmission {
  id: string
  pickerClientId: string
  pickerLabel: string | null
  selectionRound: number
  itemCount: number
  createdAt: number
  keys: string[]
  items: ShareSelectionItem[]
}

export interface ShareWithSelectionMeta extends ShareItem {
  submissionCount: number
}

export interface ShareSelectionPendingItem {
  shareId: string
  token: string
  displayName: string
  cosPrefix: string | null
  submissionCount: number
  latestSubmissionAt: number
}

const PICKER_CLIENT_ID_KEY = 'filedeal_share_picker_client_id'
const SELECTION_SEEN_PREFIX = 'filedeal_selection_seen_'

export function getOrCreatePickerClientId(): string {
  try {
    const existing = localStorage.getItem(PICKER_CLIENT_ID_KEY)
    if (existing && /^[a-f0-9-]{36}$/i.test(existing)) {
      return existing.toLowerCase()
    }
    const id = crypto.randomUUID()
    localStorage.setItem(PICKER_CLIENT_ID_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export function getSelectionLastSeenMs(shareId: string): number {
  try {
    const v = localStorage.getItem(`${SELECTION_SEEN_PREFIX}${shareId}`)
    return v ? Number(v) : 0
  } catch {
    return 0
  }
}

export function markSelectionSeen(shareId: string, atMs = Date.now()): void {
  try {
    localStorage.setItem(`${SELECTION_SEEN_PREFIX}${shareId}`, String(atMs))
  } catch {
    /* ignore */
  }
}

export function buildShareDeepLink(token: string): string {
  return `filedeal://share/${token}`
}

export function buildShareApiUrl(token: string): string {
  const base = getAuthApiBaseUrl().replace(/\/$/, '')
  return `${base}/share/${token}`
}

export function shareCreate(body: {
  resourceType: ShareResourceType
  key?: string
  prefix?: string
  permission?: SharePermission
  expiresInHours?: number | null
  selectionEnabled?: boolean
  selectionRound?: number
  recommendedKeys?: string[]
  assetVariant?: ShareAssetVariant
  hideQualityFailed?: boolean
}): Promise<ShareCreateResult> {
  return authFetchJson('/share/create', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function shareUpdateMeta(body: {
  shareId: string
  selectionRound?: number
  recommendedKeys?: string[]
  assetVariant?: ShareAssetVariant
  hideQualityFailed?: boolean
}): Promise<ShareItem | null> {
  return authFetchJson('/share/update-meta', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function shareRevoke(body: { shareId?: string; token?: string }): Promise<null> {
  return authFetchJson('/share/revoke', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function shareMine(params?: { page?: number; pageSize?: number }): Promise<{
  items: ShareItem[]
  total: number
  page: number
  pageSize: number
}> {
  const q = new URLSearchParams()
  if (params?.page != null) q.set('page', String(params.page))
  if (params?.pageSize != null) q.set('pageSize', String(params.pageSize))
  const qs = q.toString()
  return authFetchJson(`/share/mine${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export function shareGetPublic(token: string): Promise<SharePublicMeta> {
  return authFetchJson(`/share/${encodeURIComponent(token)}`, { method: 'GET' }, { skipAuth: true })
}

export function shareBrowsePublic(token: string, prefix?: string): Promise<ShareBrowseResult> {
  const q = new URLSearchParams()
  if (prefix !== undefined && prefix !== '') q.set('prefix', prefix)
  const qs = q.toString()
  return authFetchJson(
    `/share/${encodeURIComponent(token)}/browse${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
    { skipAuth: true }
  )
}

export function sharePresignGetPublic(
  token: string,
  body: { key?: string; variant?: SharePresignGetVariant; originalKey?: string }
): Promise<{ previewUrl: string; expiresAt: number; originalKey?: string; presignKey?: string }> {
  return authFetchJson(
    `/share/${encodeURIComponent(token)}/presign-get`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    { skipAuth: true }
  )
}

export function shareSubmitSelection(
  token: string,
  body: {
    pickerClientId: string
    pickerLabel?: string
    selectionRound?: number
    items?: { key: string; tier: SelectionTier; note?: string }[]
    keys?: string[]
  }
): Promise<{ submissionId: string; itemCount: number; selectionRound: number; createdAt: number }> {
  return authFetchJson(
    `/share/${encodeURIComponent(token)}/submit-selection`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    { skipAuth: true }
  )
}

export function shareSelectionSummary(shareId: string): Promise<{
  shareId: string
  picks: ShareSelectionPickSummary[]
}> {
  const q = new URLSearchParams({ shareId })
  return authFetchJson(`/share/selections/summary?${q.toString()}`, { method: 'GET' })
}

export function shareSelectionSubmissions(
  shareId: string,
  params?: { page?: number; pageSize?: number }
): Promise<{ items: ShareSelectionSubmission[]; total: number; page: number; pageSize: number }> {
  const q = new URLSearchParams({ shareId })
  if (params?.page != null) q.set('page', String(params.page))
  if (params?.pageSize != null) q.set('pageSize', String(params.pageSize))
  return authFetchJson(`/share/selections/submissions?${q.toString()}`, { method: 'GET' })
}

export function shareSelectionsByFolderPrefix(folderKey: string): Promise<{ shares: ShareWithSelectionMeta[] }> {
  const q = new URLSearchParams({ folderKey })
  return authFetchJson(`/share/selections/by-prefix?${q.toString()}`, { method: 'GET' })
}

export function shareSelectionPending(sinceMs?: number): Promise<{ items: ShareSelectionPendingItem[] }> {
  const q = new URLSearchParams()
  if (sinceMs != null) q.set('sinceMs', String(sinceMs))
  const qs = q.toString()
  return authFetchJson(`/share/selections/pending${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export function shareSelectionRemapKeys(
  shareId: string,
  mappings: { fromKey: string; toKey: string }[]
): Promise<{ updated: number; mappings: number }> {
  return authFetchJson('/share/selections/remap-keys', {
    method: 'POST',
    body: JSON.stringify({ shareId, mappings }),
  })
}

export function shareSelectionDiff(
  shareId: string,
  roundA: number,
  roundB: number
): Promise<{
  shareId: string
  roundA: number
  roundB: number
  added: string[]
  removed: string[]
  unchanged: string[]
}> {
  const q = new URLSearchParams({
    shareId,
    roundA: String(roundA),
    roundB: String(roundB),
  })
  return authFetchJson(`/share/selections/diff?${q.toString()}`, { method: 'GET' })
}

export function parseShareTokenFromHash(hash: string): string | null {
  const h = hash.replace(/^#/, '').trim()
  const m = h.match(/^share\/([a-f0-9]{32})$/i)
  return m ? m[1]!.toLowerCase() : null
}

/** 从用户粘贴的链接、hash 或纯令牌中解析 32 位分享 token */
export function parseShareTokenFromInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return trimmed.toLowerCase()
  }

  const hashToken = parseShareTokenFromHash(trimmed.startsWith('#') ? trimmed : `#${trimmed.replace(/^#*/, '')}`)
  if (hashToken) return hashToken

  const deepLink = trimmed.match(/filedeal:\/\/share\/([a-f0-9]{32})/i)
  if (deepLink) return deepLink[1]!.toLowerCase()

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://placeholder/${trimmed.replace(/^\//, '')}`)
    const hashFromUrl = parseShareTokenFromHash(url.hash)
    if (hashFromUrl) return hashFromUrl
    const pathMatch = url.pathname.match(/\/share\/([a-f0-9]{32})\/?$/i)
    if (pathMatch) return pathMatch[1]!.toLowerCase()
  } catch {
    /* not a URL */
  }

  const anywhere = trimmed.match(/(?:share\/|^)([a-f0-9]{32})/i)
  return anywhere ? anywhere[1]!.toLowerCase() : null
}

export async function copyShareLink(token: string): Promise<string> {
  const text = buildShareDeepLink(token)
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
  }
  return text
}
