import { authFetchJson } from './authClient'

export interface AdminUserCosQuota {
  userId: string
  email: string
  displayName: string
  quotaBytes: number
  defaultQuotaBytesForNewUsers: number
  usage: { imageCount: number; totalBytes: number } | null
}

export interface AdminQuotaAdjustment {
  id: string
  userId: string
  operatorUserId: string | null
  previousQuotaBytes: number
  newQuotaBytes: number
  deltaBytes: number
  remark: string | null
  createdAt: number
}

export function adminGetUserCosQuota(query: {
  userId?: string
  email?: string
}): Promise<AdminUserCosQuota> {
  const q = new URLSearchParams()
  if (query.userId) q.set('userId', query.userId)
  if (query.email) q.set('email', query.email)
  const qs = q.toString()
  return authFetchJson<AdminUserCosQuota>(`/admin/users/cos-quota${qs ? `?${qs}` : ''}`, { method: 'GET' })
}

export function adminAdjustUserCosQuota(body: {
  userId?: string
  email?: string
  quotaBytes?: number
  addQuotaBytes?: number
  remark?: string
}): Promise<{
  userId: string
  email: string
  displayName: string
  previousQuotaBytes: number
  newQuotaBytes: number
  deltaBytes: number
}> {
  return authFetchJson('/admin/users/cos-quota', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function adminGetUserCosQuotaHistory(
  userId: string,
  limit = 20
): Promise<AdminQuotaAdjustment[]> {
  const q = new URLSearchParams({ userId, limit: String(limit) })
  return authFetchJson<AdminQuotaAdjustment[]>(`/admin/users/cos-quota/history?${q.toString()}`, {
    method: 'GET',
  })
}
