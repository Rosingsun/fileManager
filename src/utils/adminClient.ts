import { authFetchJson } from './authClient'

export interface AdminUserCosQuota {
  userId: string
  email: string
  displayName: string
  quotaBytes: number
  defaultQuotaBytesForNewUsers: number
  usage: { imageCount: number; totalBytes: number } | null
}

export interface AdminUserCosQuotaListItem {
  userId: string
  email: string
  displayName: string
  quotaBytes: number
  createdAt: number
  usage: { imageCount: number; totalBytes: number } | null
}

export interface AdminUserCosQuotaListQuery {
  keyword?: string
  minQuotaGb?: number
  maxQuotaGb?: number
  page?: number
  pageSize?: number
  sortBy?: 'email' | 'displayName' | 'quotaBytes' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
  withUsage?: boolean
  usageLevel?: 'all' | 'high' | 'over'
}

export interface AdminUserCosQuotaListResult {
  items: AdminUserCosQuotaListItem[]
  total: number
  page: number
  pageSize: number
  defaultQuotaBytesForNewUsers: number
  cosConfigured: boolean
}

export function adminListUsersCosQuota(
  query: AdminUserCosQuotaListQuery = {}
): Promise<AdminUserCosQuotaListResult> {
  const q = new URLSearchParams()
  if (query.keyword?.trim()) q.set('keyword', query.keyword.trim())
  if (query.minQuotaGb != null && Number.isFinite(query.minQuotaGb)) q.set('minQuotaGb', String(query.minQuotaGb))
  if (query.maxQuotaGb != null && Number.isFinite(query.maxQuotaGb)) q.set('maxQuotaGb', String(query.maxQuotaGb))
  if (query.page != null) q.set('page', String(query.page))
  if (query.pageSize != null) q.set('pageSize', String(query.pageSize))
  if (query.sortBy) q.set('sortBy', query.sortBy)
  if (query.sortOrder) q.set('sortOrder', query.sortOrder)
  if (query.withUsage) q.set('withUsage', 'true')
  if (query.usageLevel && query.usageLevel !== 'all') q.set('usageLevel', query.usageLevel)
  const qs = q.toString()
  return authFetchJson<AdminUserCosQuotaListResult>(
    `/admin/users/cos-quota/list${qs ? `?${qs}` : ''}`,
    { method: 'GET' }
  )
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
