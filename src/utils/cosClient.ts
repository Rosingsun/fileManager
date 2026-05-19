import { authFetchJson, authPostBinaryJson } from './authClient'

export interface CosBrowseResult {
  scopePrefix: string
  currentPrefix: string
  delimiter: string
  commonPrefixes: string[]
  objects: { key: string; size: number; lastModified: string | null }[]
  isTruncated: boolean
  nextMarker: string | null
}

export function cosBrowse(prefix?: string, delimiter?: string): Promise<CosBrowseResult> {
  const q = new URLSearchParams()
  if (prefix !== undefined && prefix !== '') q.set('prefix', prefix)
  if (delimiter !== undefined && delimiter !== '') q.set('delimiter', delimiter)
  const qs = q.toString()
  return authFetchJson<CosBrowseResult>(`/cos/browse${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export function cosImageStats(): Promise<{ imageCount: number; totalBytes: number }> {
  return authFetchJson<{ imageCount: number; totalBytes: number }>('/cos/image-stats', { method: 'GET' })
}

export function cosPresignUpload(body: {
  fileName: string
  contentType?: string
  parentPrefix?: string
}): Promise<{
  key: string
  method: 'PUT'
  url: string
  headers: Record<string, string>
  maxBytes: number
  expiresAt: number
}> {
  return authFetchJson('/cos/presign-upload', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function cosUploadImageViaApi(
  file: File,
  options: { parentPrefix?: string; onProgress?: (loaded: number, total: number) => void }
): Promise<{ key: string; size: number }> {
  const q = new URLSearchParams()
  q.set('fileName', file.name)
  if (options.parentPrefix) q.set('parentPrefix', options.parentPrefix)
  return authPostBinaryJson<{ key: string; size: number }>(`/cos/upload?${q.toString()}`, file, options.onProgress)
}

export type CosPresignGetVariant = 'full' | 'thumb'

export function cosPresignGet(body: {
  key: string
  variant?: CosPresignGetVariant
}): Promise<{ previewUrl: string; expiresAt: number }> {
  return authFetchJson('/cos/presign-get', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function cosMkdir(body: { parentPrefix?: string; name: string }): Promise<{ key: string }> {
  return authFetchJson('/cos/mkdir', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function cosMove(body: { fromKey: string; toKey: string }): Promise<{ key: string }> {
  return authFetchJson('/cos/move', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function cosDelete(body: { key: string }): Promise<{ ok: true }> {
  return authFetchJson('/cos/delete', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function cosRenameFolder(body: { fromKey: string; newName: string }): Promise<{ key: string }> {
  return authFetchJson('/cos/rename-folder', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function cosMoveFolder(body: { fromKey: string; targetParentPrefix?: string }): Promise<{ key: string }> {
  return authFetchJson('/cos/move-folder', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function cosDeleteFolder(body: { key: string }): Promise<{ ok: true; deleted: number }> {
  return authFetchJson('/cos/delete-folder', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
