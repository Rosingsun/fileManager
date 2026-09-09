/**
 * 阿里云盘 Provider（社区非官方协议）
 *
 * 协议要点（基于 aliyundrive-webdav / aliyundrive-uploader 等开源项目公开的协议）：
 * - 凭据：refresh_token（约 30 天有效），每次请求前自动续期 access_token
 * - 上传分片大小默认 16 MB；分片间走 create_with_proof + get_upload_url + 真实上传 + complete
 * - 快速上传：服务端按 pre_hash + size 命中即秒传（rapid_upload）
 * - 文件 ID：drive 内 32 字符串；目录用 file_id 而非路径
 *
 * ⚠️ 风险提示：
 * 阿里云盘未对外开放个人开发者 API。本实现通过社区逆向出的接口工作，
 * 协议变更或风控升级随时可能失效。生产环境请优先评估官方开放平台。
 */

import { createHash } from 'crypto'
import fs from 'fs-extra'
import { basename, extname } from 'path'
import { request as httpsRequest, RequestOptions } from 'https'
import { request as httpRequest, IncomingMessage } from 'http'
import { URL } from 'url'
import {
  CloudError,
  type CloudDownloadTicket,
  type CloudFileEntry,
  type CloudListResult,
  type CloudMkdirResult,
  type CloudProvider,
  type CloudProviderInfo,
  type CloudUploadOptions,
  type CloudUploadProgress,
} from './types'
import { clearCredential, hasCredential, isVaultAvailable, loadCredential, saveCredential } from './tokenVault'

const API_HOST = 'api.aliyundrive.com'
const UPLOAD_HOST = 'api.aliyundrive.com'
// 注意：refresh_token 接口也在 api.aliyundrive.com 上，没有独立的 auth host

const ENDPOINTS = {
  refreshToken: `/token/refresh`,
  userInfo: `/v2/user/get`,
  list: `/v2/file/list`,
  createFolder: `/v2/file/create`,
  move: `/v2/file/move`,
  delete: `/v2/file/delete`,
  rename: `/v3/file/update`,
  getDownloadUrl: `/v2/file/get_download_url`,
  // 上传
  createWithProof: `/v2/file/create_with_proof`,
  getUploadUrl: `/v2/file/get_upload_url`,
  completeUpload: `/v2/file/complete_upload`,
}

const DEFAULT_PARENT_ID = 'root'
const PART_SIZE = 16 * 1024 * 1024 // 16 MB 分片

interface CachedToken {
  accessToken: string
  refreshToken: string
  expiresAt: number
  driveId: string
  accountHint: string
}

function genSessionId(): string {
  return `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function safeJsonParse<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

interface JsonResponse {
  code?: string | number
  message?: string
  display_message?: string
  [k: string]: unknown
}

function httpJson(
  method: 'GET' | 'POST',
  host: string,
  pathName: string,
  body: unknown | undefined,
  headers: Record<string, string>
): Promise<{ status: number; data: JsonResponse }> {
  return new Promise((resolve, reject) => {
    const isHttps = host === API_HOST || host === UPLOAD_HOST
    const reqFn = isHttps ? httpsRequest : httpRequest
    const payload = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
    const opts: RequestOptions = {
      method,
      host,
      path: pathName,
      headers: {
        'User-Agent': 'file-organizer/1.0 (cloud-drive)',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }
    const req = reqFn(opts, (res: IncomingMessage) => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        const data = safeJsonParse<JsonResponse>(text) ?? {}
        resolve({ status: res.statusCode ?? 0, data })
      })
    })
    req.on('error', err => reject(new CloudError(err.message, 'network', 'aliyun-drive', true)))
    if (payload) req.write(payload)
    req.end()
  })
}

const ALIYUN_CANARY = 'client=Web,app=adrive,version=v5.4.0'

interface AliyunTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  user_id?: string
  default_drive_id?: string
  nick_name?: string
  user_name?: string
}

interface AliyunListResponse {
  items: Array<{
    file_id: string
    name: string
    type: 'file' | 'folder'
    size?: number
    updated_at?: string | number
  }>
  next_marker?: string
}

interface AliyunCreateFolderResponse {
  file_id: string
  parent_file_id: string
  name: string
}

interface AliyunCreateWithProofResponse {
  file_id: string
  parent_file_id: string
  name: string
  rapid_upload?: boolean
  part_info_list?: Array<{ part_number: number; upload_url?: string; upload_token?: string }>
}

interface AliyunGetUploadUrlResponse {
  part_info_list: Array<{ part_number: number; upload_url: string; upload_token: string }>
}

interface AliyunCompleteResponse {
  file_id: string
  name: string
  size?: number
}

interface AliyunDownloadUrlResponse {
  url: string
  expiration: string | number
  file_name?: string
  size?: number
}

export class AliyunDriveProvider implements CloudProvider {
  readonly info: CloudProviderInfo = {
    id: 'aliyun-drive',
    name: '阿里云盘',
    requiresNetwork: true,
    riskNotice:
      '阿里云盘暂未对个人开发者开放官方 API，本集成通过社区维护的非官方协议实现，' +
      '接口随时可能变更。仅供个人备份与学习使用，请勿用于商业用途；高频调用存在被限流或封号风险。',
  }

  private cache: CachedToken | null = null
  private inflightRefresh: Promise<CachedToken> | null = null
  /** 下载 URL 内存缓存（fileId -> ticket），避免照片墙等场景对同一文件反复申请下载地址 */
  private downloadTicketCache = new Map<string, CloudDownloadTicket>()

  async hasCredentials(): Promise<boolean> {
    return hasCredential('aliyun-drive')
  }

  async setCredentials(raw: string): Promise<{ accountHint: string }> {
    const trimmed = raw.trim()
    if (!trimmed) {
      throw new CloudError('凭证不能为空', 'invalid_argument', this.info.id)
    }
    if (!isVaultAvailable()) {
      throw new CloudError('当前系统未提供加密能力，无法安全保存云盘凭证', 'unknown', this.info.id)
    }
    // 先校验、后落盘：验证通过前不写入磁盘，避免无效凭证残留导致本地状态不一致
    const session = await this.refreshOnce(trimmed)
    const info = await this.fetchUserInfo(session)
    if (!info.ok) {
      throw new CloudError(info.error ?? '凭证无效', 'not_authorized', this.info.id)
    }
    // 验证通过后落盘，保存 rotate 后的新 refresh_token（服务端未下发新 token 时回退到用户输入）
    const toStore = session.refreshToken || trimmed
    const res = saveCredential('aliyun-drive', toStore)
    if (!res.ok) {
      throw new CloudError(res.error ?? '凭证保存失败', 'unknown', this.info.id)
    }
    this.cache = { ...session, refreshToken: toStore, accountHint: info.accountHint || session.accountHint }
    return { accountHint: info.accountHint || session.accountHint }
  }

  async clearCredentials(): Promise<void> {
    clearCredential('aliyun-drive')
    this.cache = null
  }

  async validateCredentials(): Promise<{ ok: boolean; accountHint?: string; error?: string }> {
    try {
      this.cache = null
      const token = await this.ensureToken()
      return await this.fetchUserInfo(token)
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  }

  async list(parentId: string, cursor?: string): Promise<CloudListResult> {
    return this.listPage(parentId, cursor, 100)
  }

  async mkdir(parentId: string, name: string): Promise<CloudMkdirResult> {
    const token = await this.ensureToken()
    const body = {
      drive_id: token.driveId,
      parent_file_id: parentId || DEFAULT_PARENT_ID,
      name,
      type: 'folder',
      check_name_mode: 'refuse',
    }
    const { status, data } = await httpJson('POST', API_HOST, ENDPOINTS.createFolder, body, this.authHeaders(token))
    if (status >= 200 && status < 300 && data.code === undefined) {
      const r = data as unknown as AliyunCreateFolderResponse
      return { fileId: r.file_id, parentId: r.parent_file_id, name: r.name }
    }
    // 已存在：尝试查询同名 folder，命中即返回
    if ((data.code === 'AlreadyExist' || data.code === 'FileAlreadyExists') && !name.endsWith('(1)')) {
      const existing = await this.findChildByName(parentId, name, 'folder')
      if (existing) {
        return { fileId: existing, parentId, name }
      }
    }
    this.assertOk(status, data)
    throw new CloudError('unknown', 'unknown', this.info.id)
  }

  async remove(fileId: string): Promise<void> {
    const token = await this.ensureToken()
    const { status, data } = await httpJson(
      'POST',
      API_HOST,
      ENDPOINTS.delete,
      { drive_id: token.driveId, file_id: fileId },
      this.authHeaders(token)
    )
    this.assertOk(status, data)
  }

  async rename(fileId: string, newName: string): Promise<void> {
    const token = await this.ensureToken()
    const { status, data } = await httpJson(
      'POST',
      API_HOST,
      ENDPOINTS.rename,
      { drive_id: token.driveId, file_id: fileId, name: newName },
      this.authHeaders(token)
    )
    this.assertOk(status, data)
  }

  async move(fileId: string, newParentId: string, newName?: string): Promise<void> {
    const token = await this.ensureToken()
    const body: Record<string, unknown> = {
      drive_id: token.driveId,
      file_id: fileId,
      to_parent_file_id: newParentId || DEFAULT_PARENT_ID,
    }
    if (newName) body.new_name = newName
    const { status, data } = await httpJson('POST', API_HOST, ENDPOINTS.move, body, this.authHeaders(token))
    this.assertOk(status, data)
  }

  async getDownloadTicket(fileId: string): Promise<CloudDownloadTicket> {
    const cached = this.downloadTicketCache.get(fileId)
    if (cached && cached.expiresAt - 60_000 > Date.now()) {
      return { ...cached }
    }
    const token = await this.ensureToken()
    const { status, data } = await httpJson(
      'POST',
      API_HOST,
      ENDPOINTS.getDownloadUrl,
      { drive_id: token.driveId, file_id: fileId },
      this.authHeaders(token)
    )
    this.assertOk(status, data)
    const r = data as unknown as AliyunDownloadUrlResponse
    const expRaw = typeof r.expiration === 'string' ? Date.parse(r.expiration) : Number(r.expiration)
    const ticket: CloudDownloadTicket = {
      url: r.url,
      expiresAt: Number.isFinite(expRaw) && expRaw > Date.now() ? expRaw : Date.now() + 30 * 60_000,
      fileName: r.file_name ?? '',
      size: r.size ?? 0,
    }
    this.downloadTicketCache.set(fileId, ticket)
    this.cleanupDownloadTicketCache()
    return { ...ticket }
  }

  /** 缓存过大时清理过期项；仍超限则整体清空，防止内存膨胀 */
  private cleanupDownloadTicketCache(): void {
    if (this.downloadTicketCache.size <= 2000) return
    const now = Date.now()
    for (const [k, v] of this.downloadTicketCache) {
      if (v.expiresAt - 60_000 <= now) this.downloadTicketCache.delete(k)
    }
    if (this.downloadTicketCache.size > 2000) {
      this.downloadTicketCache.clear()
    }
  }

  async uploadFile(
    localPath: string,
    options: CloudUploadOptions,
    onProgress: (p: CloudUploadProgress) => void,
    signal: AbortSignal
  ): Promise<{ fileId: string; name: string; size: number }> {
    const token = await this.ensureToken()
    const fileStat = await fs.stat(localPath)
    if (!fileStat.isFile()) {
      throw new CloudError('本地路径不是文件', 'invalid_argument', this.info.id)
    }
    const fileSize = fileStat.size
    const originalName = basename(localPath)
    const sessionId = genSessionId()
    const baseProgress: Omit<CloudUploadProgress, 'percent' | 'status' | 'loaded'> = {
      sessionId,
      filePath: localPath,
      fileName: originalName,
      fileSize,
      parentId: options.parentId || DEFAULT_PARENT_ID,
    }

    onProgress({ ...baseProgress, loaded: 0, percent: 0, status: 'preparing' })
    if (signal.aborted) {
      throw new CloudError('已取消', 'canceled', this.info.id)
    }

    // 同名去重
    const finalName = options.skipIfExists
      ? originalName
      : await this.uniqueName(options.parentId || DEFAULT_PARENT_ID, originalName)

    // 计算 SHA1（用于秒传；这里直接读全文件 SHA1）
    const proof = await this.computeFileSha1WithProgress(localPath, fileSize, (loaded) => {
      onProgress({
        ...baseProgress,
        loaded,
        percent: Math.min(20, Math.floor((loaded / fileSize) * 20)),
        status: 'preparing',
      })
      if (signal.aborted) throw new CloudError('已取消', 'canceled', this.info.id)
    })

    const createBody = {
      drive_id: token.driveId,
      parent_file_id: options.parentId || DEFAULT_PARENT_ID,
      name: finalName,
      type: 'file',
      size: fileSize,
      check_name_mode: 'refuse',
      content_hash: proof.contentHash,
      content_hash_name: 'sha1',
      proof_code: proof.proofCode,
      proof_version: 'v1',
    }
    const { status, data } = await httpJson('POST', UPLOAD_HOST, ENDPOINTS.createWithProof, createBody, this.authHeaders(token))
    if (!(status >= 200 && status < 300)) {
      this.assertOk(status, data)
    }
    const createResp = data as unknown as AliyunCreateWithProofResponse

    if (createResp.rapid_upload) {
      onProgress({
        ...baseProgress,
        loaded: fileSize,
        percent: 100,
        status: 'completed',
        remoteFileId: createResp.file_id,
        remoteName: createResp.name,
      })
      return { fileId: createResp.file_id, name: createResp.name, size: fileSize }
    }

    // 分片上传
    const partCount = Math.ceil(fileSize / PART_SIZE)
    const partInfoList = createResp.part_info_list ?? (await this.fetchUploadUrls(token, createResp.file_id, partCount))
    if (!partInfoList) {
      throw new CloudError('未获取到分片上传信息', 'protocol_changed', this.info.id, true)
    }
    const partSha1List: string[] = []
    let uploaded = 0
    for (let i = 0; i < partCount; i++) {
      if (signal.aborted) throw new CloudError('已取消', 'canceled', this.info.id)
      const start = i * PART_SIZE
      const end = Math.min(start + PART_SIZE, fileSize)
      const sliceSize = end - start
      const partSha1 = await this.uploadPart(
        localPath,
        start,
        sliceSize,
        partInfoList[i]?.upload_url ?? '',
        (loaded) => {
          onProgress({
            ...baseProgress,
            loaded: uploaded + loaded,
            percent: 20 + Math.floor(((uploaded + loaded) / fileSize) * 79),
            status: 'uploading',
          })
        }
      )
      partSha1List.push(partSha1)
      uploaded += sliceSize
    }

    // 完成上传
    const complete = await httpJson(
      'POST',
      UPLOAD_HOST,
      ENDPOINTS.completeUpload,
      {
        drive_id: token.driveId,
        file_id: createResp.file_id,
        upload_id: undefined,
        part_info_list: partInfoList.map((p, idx) => ({
          part_number: p.part_number ?? idx + 1,
          part_sha1: partSha1List[idx],
        })),
      },
      this.authHeaders(token)
    )
    this.assertOk(complete.status, complete.data)
    const r = complete.data as unknown as AliyunCompleteResponse
    onProgress({
      ...baseProgress,
      loaded: fileSize,
      percent: 100,
      status: 'completed',
      remoteFileId: r.file_id,
      remoteName: r.name,
    })
    return { fileId: r.file_id, name: r.name, size: fileSize }
  }

  // ----- 内部辅助 -----

  private authHeaders(token: CachedToken, method: 'GET' | 'POST' = 'POST'): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${token.accessToken}`,
      'X-Canary': ALIYUN_CANARY,
    }
    if (method === 'POST') h['Content-Type'] = 'application/json'
    return h
  }

  private async ensureToken(): Promise<CachedToken> {
    if (this.cache && this.cache.expiresAt - 60_000 > Date.now()) {
      return this.cache
    }
    if (this.inflightRefresh) {
      return this.inflightRefresh
    }
    this.inflightRefresh = (async () => {
      try {
        const raw = this.cache?.refreshToken ?? loadCredential('aliyun-drive')
        if (!raw) {
          throw new CloudError('尚未配置阿里云盘凭证', 'not_authorized', this.info.id)
        }
        const refreshed = await this.refreshOnce(raw)
        const next: CachedToken = {
          ...refreshed,
          refreshToken: refreshed.refreshToken || raw,
          driveId: refreshed.driveId || this.cache?.driveId || '',
          accountHint: refreshed.accountHint || this.cache?.accountHint || '',
        }
        // 持久化 rotate 后的新 refresh_token
        saveCredential('aliyun-drive', next.refreshToken)
        this.cache = next
        return next
      } finally {
        this.inflightRefresh = null
      }
    })()
    return this.inflightRefresh
  }

  /** 用 refresh_token 换 access_token（只走网络、不落盘），失败抛 refresh_failed */
  private async refreshOnce(rawRefreshToken: string): Promise<CachedToken> {
    const { status, data } = await httpJson(
      'POST',
      API_HOST,
      ENDPOINTS.refreshToken,
      { grant_type: 'refresh_token', refresh_token: rawRefreshToken },
      { 'Content-Type': 'application/json' }
    )
    if (!(status >= 200 && status < 300)) {
      throw new CloudError(
        (data.display_message as string) || (data.message as string) || `refresh failed (${status})`,
        'refresh_failed',
        this.info.id,
        status >= 500
      )
    }
    const r = data as unknown as AliyunTokenResponse
    return {
      accessToken: r.access_token,
      refreshToken: r.refresh_token,
      expiresAt: Date.now() + r.expires_in * 1000,
      driveId: r.default_drive_id ?? '',
      accountHint: r.nick_name || r.user_name || '',
    }
  }

  /** 拉取用户信息，用于校验 access_token 是否可用 */
  private async fetchUserInfo(token: CachedToken): Promise<{ ok: boolean; accountHint?: string; error?: string }> {
    const { status, data } = await httpJson('GET', API_HOST, ENDPOINTS.userInfo, undefined, this.authHeaders(token, 'GET'))
    if (status >= 200 && status < 300 && data.code === undefined) {
      const nick = (data.nick_name as string) || (data.user_name as string) || ''
      return { ok: true, accountHint: nick || '已登录' }
    }
    return {
      ok: false,
      error: (data.display_message as string) || (data.message as string) || `HTTP ${status}`,
    }
  }

  private assertOk(status: number, data: JsonResponse): void {
    if (status >= 200 && status < 300 && data.code === undefined) return
    const code = String(data.code ?? '')
    console.error('[aliyun-drive] 云盘接口返回错误', JSON.stringify({ status, code, message: data.message, display_message: data.display_message }))
    const message = (data.display_message as string) || (data.message as string) || `HTTP ${status}`
    let errCode: import('./types').CloudErrorCode = 'unknown'
    if (code === 'AccessTokenInvalid' || code === 'AccessTokenExpired' || code === 'InvalidToken') errCode = 'token_expired'
    else if (code === 'UserNotFound' || code === 'UserDisable' || code === 'UserNotAuthorized') errCode = 'not_authorized'
    else if (code === 'TooManyRequests') errCode = 'rate_limited'
    else if (code === 'QuotaExhausted' || code === 'StorageFull') errCode = 'quota_exceeded'
    else if (code === 'NotFound.FileNotFound' || code === 'NotFound') errCode = 'not_found'
    else if (code === 'NotFound.ParentNotFound') errCode = 'parent_not_found'
    else if (code === 'AlreadyExist' || code === 'FileAlreadyExists' || code === 'SameNameFileOrFolderAlreadyExists') errCode = 'conflict'
    else if (code === 'InvalidArgument' || code === 'InvalidName') errCode = 'invalid_argument'
    else if (code === 'FileTooLarge') errCode = 'file_too_large'
    const retryable = status >= 500 || errCode === 'rate_limited'
    throw new CloudError(message, errCode, this.info.id, retryable)
  }

  private async listAll(parentId: string, maxItems: number): Promise<CloudFileEntry[]> {
    const items: CloudFileEntry[] = []
    let cursor: string | undefined
    while (items.length < maxItems) {
      const remaining = maxItems - items.length
      const res = await this.listPage(parentId, cursor, remaining)
      items.push(...res.items)
      if (!res.hasMore || !res.nextCursor) break
      cursor = res.nextCursor
    }
    return items
  }

  private async listPage(parentId: string, cursor: string | undefined, limit: number): Promise<CloudListResult> {
    const token = await this.ensureToken()
    const body = {
      drive_id: token.driveId,
      parent_file_id: parentId || DEFAULT_PARENT_ID,
      limit,
      order_by: 'updated_at',
      order_direction: 'DESC',
      ...(cursor ? { marker: cursor } : {}),
    }
    const { status, data } = await httpJson('POST', API_HOST, ENDPOINTS.list, body, this.authHeaders(token))
    this.assertOk(status, data)
    const resp = data as unknown as AliyunListResponse
    const items: CloudFileEntry[] = (resp.items ?? []).map(it => ({
      fileId: it.file_id,
      name: it.name,
      kind: it.type,
      size: it.size ?? 0,
      modifiedTime: typeof it.updated_at === 'string' ? Date.parse(it.updated_at) : (it.updated_at as number),
    }))
    return {
      parentId: parentId || DEFAULT_PARENT_ID,
      items,
      hasMore: Boolean(resp.next_marker),
      nextCursor: resp.next_marker,
    }
  }

  private async findChildByName(parentId: string, name: string, kind: 'file' | 'folder'): Promise<string | null> {
    const items = await this.listAll(parentId, 500)
    const hit = items.find(it => it.kind === kind && it.name === name)
    return hit?.fileId ?? null
  }

  private async uniqueName(parentId: string, name: string): Promise<string> {
    const ext = extname(name)
    const stem = name.slice(0, name.length - ext.length)
    const items = await this.listAll(parentId, 500)
    const existing = new Set(items.map(i => i.name))
    if (!existing.has(name)) return name
    let i = 1
    while (existing.has(`${stem}_${i}${ext}`)) i += 1
    return `${stem}_${i}${ext}`
  }

  private async computeFileSha1WithProgress(
    localPath: string,
    fileSize: number,
    onChunk: (loaded: number) => void
  ): Promise<{ contentHash: string; proofCode: string }> {
    const fs = require('fs') as typeof import('fs')
    const partSizeForProof = 1024 * 1024
    const full = createHash('sha1')
    const proofs: string[] = []
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(localPath, { highWaterMark: PART_SIZE })
      let loaded = 0
      let partBuf = Buffer.alloc(0)
      let partSha1 = createHash('sha1')
      stream.on('data', (chunk: string | Buffer) => {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
        full.update(buf)
        loaded += buf.length
        onChunk(loaded)
        partBuf = Buffer.concat([partBuf, buf])
        while (partBuf.length >= partSizeForProof) {
          const slice = partBuf.subarray(0, partSizeForProof)
          partSha1.update(slice)
          proofs.push(partSha1.digest('hex'))
          partSha1 = createHash('sha1')
          partBuf = partBuf.subarray(partSizeForProof)
        }
      })
      stream.on('error', err => reject(new CloudError(err.message, 'unknown', this.info.id)))
      stream.on('end', () => {
        if (partBuf.length > 0) {
          partSha1.update(partBuf)
          proofs.push(partSha1.digest('hex'))
        }
        const contentHash = full.digest('hex')
        const proofCode = createHash('sha1').update(Buffer.from(proofs.join(''), 'hex')).digest('hex')
        resolve({ contentHash, proofCode })
      })
      void fileSize
    })
  }

  private async fetchUploadUrls(
    token: CachedToken,
    fileId: string,
    partCount: number
  ): Promise<AliyunCreateWithProofResponse['part_info_list']> {
    const body = {
      drive_id: token.driveId,
      file_id: fileId,
      part_info_list: Array.from({ length: partCount }, (_, i) => ({ part_number: i + 1 })),
    }
    const { status, data } = await httpJson('POST', UPLOAD_HOST, ENDPOINTS.getUploadUrl, body, this.authHeaders(token))
    this.assertOk(status, data)
    return (data as unknown as AliyunGetUploadUrlResponse).part_info_list
  }

  private async uploadPart(
    localPath: string,
    start: number,
    size: number,
    uploadUrl: string,
    onChunk: (loaded: number) => void
  ): Promise<string> {
    if (!uploadUrl) {
      throw new CloudError('分片上传 URL 为空', 'protocol_changed', this.info.id, true)
    }
    return new Promise((resolve, reject) => {
      const fs = require('fs') as typeof import('fs')
      const stream = fs.createReadStream(localPath, { start, end: start + size })
      const url = new URL(uploadUrl)
      const isHttps = url.protocol === 'https:'
      const reqFn = isHttps ? httpsRequest : httpRequest
      const chunks: Buffer[] = []
      const sha1 = createHash('sha1')
      const headers: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(size),
      }
      const req = reqFn(
        {
          method: 'PUT',
          host: url.host,
          path: url.pathname + (url.search || ''),
          headers,
        },
        res => {
          res.on('data', c => chunks.push(c))
          res.on('end', () => {
            if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300) {
              resolve(sha1.digest('hex'))
            } else {
              const text = Buffer.concat(chunks).toString('utf8')
              reject(
                new CloudError(
                  `分片上传失败 HTTP ${res.statusCode} ${text.slice(0, 200)}`,
                  'network',
                  this.info.id,
                  true
                )
              )
            }
          })
        }
      )
      req.on('error', err => reject(new CloudError(err.message, 'network', this.info.id, true)))
      stream.on('data', (c: string | Buffer) => {
        const buf = typeof c === 'string' ? Buffer.from(c) : c
        sha1.update(buf)
        onChunk(Math.min(size, stream.bytesRead - start + buf.length))
      })
      stream.on('error', err => reject(new CloudError(err.message, 'unknown', this.info.id)))
      stream.pipe(req)
    })
  }
}
