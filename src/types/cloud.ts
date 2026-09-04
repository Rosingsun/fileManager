/**
 * 云盘相关渲染层类型声明
 * 与 electron/main/services/cloud/types.ts 保持字段一致
 */

export type CloudProviderId = 'aliyun-drive'

export interface CloudProviderInfo {
  id: CloudProviderId
  name: string
  requiresNetwork: boolean
  riskNotice?: string
}

export interface CloudFileEntry {
  fileId: string
  name: string
  kind: 'file' | 'folder'
  size: number
  modifiedTime?: number
  downloadUrl?: string
}

export interface CloudListResult {
  parentId: string
  items: CloudFileEntry[]
  hasMore: boolean
  nextCursor?: string
}

export interface CloudMkdirResult {
  fileId: string
  parentId: string
  name: string
}

export interface CloudUploadOptions {
  parentId: string
  skipIfExists?: boolean
}

export interface CloudUploadProgress {
  sessionId: string
  filePath: string
  fileName: string
  fileSize: number
  loaded: number
  status: 'preparing' | 'uploading' | 'completed' | 'failed'
  percent: number
  error?: string
  remoteFileId?: string
  remoteName?: string
  parentId: string
}

export interface CloudDownloadTicket {
  url: string
  expiresAt: number
  fileName: string
  size: number
}

export type CloudErrorCode =
  | 'not_authorized'
  | 'token_expired'
  | 'refresh_failed'
  | 'network'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'invalid_argument'
  | 'not_found'
  | 'parent_not_found'
  | 'conflict'
  | 'protocol_changed'
  | 'file_too_large'
  | 'canceled'
  | 'unknown'

export interface CloudResponse<T> {
  ok: boolean
  data?: T
  code?: CloudErrorCode | string
  message?: string
  retryable?: boolean
}

export interface CloudValidateResult {
  ok: boolean
  accountHint?: string
  error?: string
}
