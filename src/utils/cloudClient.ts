/**
 * 云盘客户端（渲染层）
 * - 统一包装 IPC，统一错误抛出
 * - 提供上传会话管理（生成 sessionId、暴露进度订阅）
 */

import { message } from 'antd'
import type {
  CloudDownloadTicket,
  CloudErrorCode,
  CloudListResult,
  CloudMkdirResult,
  CloudProviderId,
  CloudProviderInfo,
  CloudResponse,
  CloudUploadOptions,
  CloudUploadProgress,
  CloudValidateResult,
} from '../types/cloud'

export class CloudClientError extends Error {
  constructor(
    message: string,
    public readonly code: CloudErrorCode | string,
    public readonly retryable: boolean
  ) {
    super(message)
    this.name = 'CloudClientError'
  }
}

function unwrap<T>(res: CloudResponse<T>): T {
  if (res.ok && res.data !== undefined) return res.data
  throw new CloudClientError(res.message ?? '操作失败', res.code ?? 'unknown', !!res.retryable)
}

function getApi() {
  if (typeof window === 'undefined' || !window.electronAPI?.cloud) {
    throw new CloudClientError('云盘功能不可用（electronAPI 未注入）', 'unknown', false)
  }
  return window.electronAPI.cloud
}

export async function listCloudProviders(): Promise<CloudProviderInfo[]> {
  return getApi().listProviders()
}

export async function isCloudVaultAvailable(): Promise<boolean> {
  return getApi().isVaultAvailable()
}

export async function hasCloudCredentials(providerId: CloudProviderId): Promise<boolean> {
  return getApi().hasCredentials(providerId)
}

export async function setCloudCredentials(
  providerId: CloudProviderId,
  raw: string
): Promise<{ accountHint: string; maskedToken: string }> {
  const res = await getApi().setCredentials(providerId, raw)
  if (!res.ok) {
    throw new CloudClientError(res.message ?? '凭证保存失败', res.code ?? 'unknown', !!res.retryable)
  }
  return { accountHint: res.accountHint ?? '', maskedToken: res.maskedToken ?? '' }
}

export async function clearCloudCredentials(providerId: CloudProviderId): Promise<void> {
  await getApi().clearCredentials(providerId)
}

export async function validateCloudCredentials(
  providerId: CloudProviderId
): Promise<CloudValidateResult> {
  return getApi().validateCredentials(providerId)
}

export async function cloudList(
  providerId: CloudProviderId,
  parentId: string,
  cursor?: string
): Promise<CloudListResult> {
  return unwrap(await getApi().list(providerId, parentId, cursor))
}

export async function cloudMkdir(
  providerId: CloudProviderId,
  parentId: string,
  name: string
): Promise<CloudMkdirResult> {
  return unwrap(await getApi().mkdir(providerId, parentId, name))
}

export async function cloudRemove(providerId: CloudProviderId, fileId: string): Promise<void> {
  unwrap(await getApi().remove(providerId, fileId))
}

export async function cloudRename(
  providerId: CloudProviderId,
  fileId: string,
  newName: string
): Promise<void> {
  unwrap(await getApi().rename(providerId, fileId, newName))
}

export async function cloudMove(
  providerId: CloudProviderId,
  fileId: string,
  newParentId: string,
  newName?: string
): Promise<void> {
  unwrap(await getApi().move(providerId, fileId, newParentId, newName))
}

export async function cloudGetDownloadTicket(
  providerId: CloudProviderId,
  fileId: string
): Promise<CloudDownloadTicket> {
  return unwrap(await getApi().getDownloadTicket(providerId, fileId))
}

export async function cloudOpenExternal(url: string): Promise<{ ok: boolean }> {
  return getApi().openExternal(url)
}

export function generateUploadSessionId(): string {
  return `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface UploadTaskHandle {
  sessionId: string
  promise: Promise<{ fileId: string; name: string; size: number }>
  cancel: () => Promise<void>
}export function startCloudUpload(
  providerId: CloudProviderId,
  localPath: string,
  options: CloudUploadOptions,
  sessionId: string = generateUploadSessionId()
): UploadTaskHandle {
  const promise = (async () => {
    const res = await getApi().upload(providerId, localPath, options, sessionId)
    if (!res.ok || !res.data) {
      throw new CloudClientError(res.message ?? '上传失败', res.code ?? 'unknown', !!res.retryable)
    }
    return res.data
  })()
  return {
    sessionId,
    promise,
    cancel: async () => {
      await getApi().cancelUpload(sessionId)
    },
  }
}

export function subscribeUploadProgress(
  cb: (p: CloudUploadProgress) => void
): () => void {
  return getApi().onUploadProgress(cb)
}

export function describeCloudError(err: unknown): string {
  if (err instanceof CloudClientError) {
    switch (err.code) {
      case 'not_authorized':
        return '尚未配置云盘凭证或凭证已失效，请在右上角点击「配置凭证」重新填写'
      case 'token_expired':
        return '云盘访问令牌已过期，正在尝试自动续期失败，请重试或重新配置凭证'
      case 'refresh_failed':
        return '云盘凭证续期失败，请检查网络或重新获取 refresh_token'
      case 'rate_limited':
        return '云盘请求被限流，请稍后再试'
      case 'quota_exceeded':
        return '云盘存储空间已满，请清理后再上传'
      case 'invalid_argument':
        return `参数错误：${err.message}`
      case 'not_found':
        return '文件不存在或已被删除'
      case 'parent_not_found':
        return '目标文件夹不存在'
      case 'conflict':
        return '已存在同名文件/文件夹'
      case 'file_too_large':
        return '文件超过云盘单文件大小限制'
      case 'protocol_changed':
        return '云盘协议已变更，本版本暂不兼容，请关注后续更新'
      case 'canceled':
        return '操作已取消'
      case 'network':
        return `网络异常：${err.message}`
      default:
        return err.message
    }
  }
  if (err instanceof Error) return err.message
  return '未知错误'
}

export function showCloudError(err: unknown): void {
  message.error(describeCloudError(err))
}
