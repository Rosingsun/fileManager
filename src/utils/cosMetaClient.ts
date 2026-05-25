import { authFetchJson } from './authClient'

export interface CosObjectMetaItem {
  cosKey: string
  contentCategory: string | null
  qualityPass: boolean | null
  qualityIssues: unknown
  exifCaptureAt: number | null
  updatedAt: number
}

export function cosMetaListByPrefix(prefix: string): Promise<{ items: CosObjectMetaItem[] }> {
  const q = new URLSearchParams({ prefix })
  return authFetchJson(`/cos/meta/by-prefix?${q.toString()}`, { method: 'GET' })
}

export function cosMetaBatchUpsert(
  items: {
    cosKey: string
    contentCategory?: string | null
    qualityPass?: boolean | null
    qualityIssues?: string[] | null
    exifCaptureAt?: number | null
  }[]
): Promise<{ updated: number }> {
  return authFetchJson('/cos/meta/batch-upsert', {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}
