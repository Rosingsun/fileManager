/**
 * 云盘 Provider 抽象层（主进程）
 *
 * 设计目标：
 * - 统一多个云盘（阿里云盘、OneDrive、WebDAV、S3 等）的接口
 * - 凭证（refresh_token / cookie）通过 tokenVault 加密存储
 * - 失败时可重试，错误归一为 CloudError
 * - 上传支持分片 + 进度回调（onProgress）
 *
 * 注意：阿里云盘目前没有官方公开 API，本模块以社区已知的非官方协议
 * （基于 refresh_token 续期 + 分片上传 + 快速上传 SHA1）实现，
 * 协议字段可能随阿里云盘客户端变更而失效，调用方应捕获 CloudError。
 */

export type CloudProviderId = 'aliyun-drive'

export interface CloudProviderInfo {
  id: CloudProviderId
  name: string
  /** 是否需要网络请求（WebDAV、对象存储类为 true；本地挂载为 false） */
  requiresNetwork: boolean
  /** 用户视角的风险提示（HTML 片段或纯文本） */
  riskNotice?: string
}

/** 单条文件的元数据 */
export interface CloudFileEntry {
  fileId: string
  name: string
  /** "file" / "folder" */
  kind: 'file' | 'folder'
  size: number
  /** 毫秒时间戳，文件夹可能为空 */
  modifiedTime?: number
  /** 用于跳转（如阿里云盘 web URL），可选 */
  downloadUrl?: string
}

/** 分页列出目录 */
export interface CloudListResult {
  parentId: string
  items: CloudFileEntry[]
  /** 是否还有更多；非游标分页实现为 false */
  hasMore: boolean
  nextCursor?: string
}

/** 创建文件夹 */
export interface CloudMkdirResult {
  fileId: string
  parentId: string
  name: string
}

/** 上传选项 */
export interface CloudUploadOptions {
  /** 远端父目录 fileId */
  parentId: string
  /** 是否重名时跳过；默认 false（同名自动加 _1 后缀） */
  skipIfExists?: boolean
}

/** 上传进度（来自主进程 -> 渲染层） */
export interface CloudUploadProgress {
  /** 单次 upload 调用的会话 id，用于前端去重 */
  sessionId: string
  /** 本地文件绝对路径 */
  filePath: string
  fileName: string
  fileSize: number
  /** 已上传字节 */
  loaded: number
  /** 状态：preparing/uploading/completed/failed */
  status: 'preparing' | 'uploading' | 'completed' | 'failed'
  /** 0-100 */
  percent: number
  /** 失败时附带的错误信息 */
  error?: string
  /** 上传成功后的远端 fileId */
  remoteFileId?: string
  /** 远端名（可能与本地不同，比如已重命名去重） */
  remoteName?: string
  /** 远端父目录 */
  parentId: string
}

/** 下载链接（短时签名） */
export interface CloudDownloadTicket {
  url: string
  /** 过期时间（毫秒时间戳） */
  expiresAt: number
  fileName: string
  size: number
}

export class CloudError extends Error {
  constructor(
    message: string,
    public readonly code: CloudErrorCode,
    public readonly providerId?: CloudProviderId,
    public readonly retryable: boolean = false
  ) {
    super(message)
    this.name = 'CloudError'
  }
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

/**
 * Provider 必须实现的最小能力集。
 * 所有方法抛错请用 CloudError，调用方据此判定是否刷新 token 后重试。
 */
export interface CloudProvider {
  readonly info: CloudProviderInfo

  /** 是否已配置凭证（不校验是否有效，只看有没有） */
  hasCredentials(): Promise<boolean>
  /** 写入凭证（refresh_token 或对应形态）；返回脱敏的账号信息 */
  setCredentials(raw: string): Promise<{ accountHint: string }>
  /** 清除凭证 */
  clearCredentials(): Promise<void>
  /** 验证凭证是否有效（轻量调用） */
  validateCredentials(): Promise<{ ok: boolean; accountHint?: string; error?: string }>

  /** 列出根目录或指定目录 */
  list(parentId: string, cursor?: string): Promise<CloudListResult>
  /** 创建文件夹（已存在同名则返回已存在的 fileId） */
  mkdir(parentId: string, name: string): Promise<CloudMkdirResult>
  /** 删除文件或文件夹（递归） */
  remove(fileId: string): Promise<void>
  /** 重命名 */
  rename(fileId: string, newName: string): Promise<void>
  /** 获取下载链接（短时） */
  getDownloadTicket(fileId: string): Promise<CloudDownloadTicket>
  /** 移动到其他父目录（改名可与 move 合并） */
  move(fileId: string, newParentId: string, newName?: string): Promise<void>

  /**
   * 上传本地文件到指定父目录。
   * 大文件内部走分片 + 进度回调；返回最终的远端 fileId。
   */
  uploadFile(
    localPath: string,
    options: CloudUploadOptions,
    onProgress: (p: CloudUploadProgress) => void,
    signal: AbortSignal
  ): Promise<{ fileId: string; name: string; size: number }>
}

/** Provider 工厂：用于将来扩展 WebDAV / OneDrive / S3 时直接注册新 provider */
export interface CloudProviderFactory {
  id: CloudProviderId
  info: CloudProviderInfo
  create(): CloudProvider
}
