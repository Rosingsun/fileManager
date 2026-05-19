import { xhrPostWithProgress, XhrHttpError } from './xhrUpload'

/**
 * 开发默认直连认证服务；后端已统一返回 Access-Control-Allow-Private-Network，避免 Chromium 跨端口预检卡死。
 * 若需经 Vite 同源代理，可在 .env.development 将 VITE_AUTH_API_BASE_URL 置空并在 electron.vite.config 的 renderer.server 配置 proxy。
 */
const DEV_AUTH_API_DEFAULT = 'http://127.0.0.1:3847'

export function getAuthApiBaseUrl(): string {
  const raw = import.meta.env.VITE_AUTH_API_BASE_URL
  const trimmed = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : ''
  if (trimmed) return trimmed
  if (import.meta.env.DEV) return DEV_AUTH_API_DEFAULT
  return ''
}

/** 开发默认同源代理，视为已配置；生产须设置非空的 VITE_AUTH_API_BASE_URL */
export function isAuthApiConfigured(): boolean {
  return import.meta.env.DEV || Boolean(getAuthApiBaseUrl())
}

export function getPasswordResetUrl(): string {
  const raw = import.meta.env.VITE_PASSWORD_RESET_URL
  return typeof raw === 'string' ? raw.trim() : ''
}

type ApiOk<T> = { ok: true; data: T }
type ApiErr = { ok: false; error: { code: string; message: string } }

export class AuthApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number
  ) {
    super(message)
    this.name = 'AuthApiError'
  }
}

let getAccessToken: () => string | null = () => null
let refreshAccess: () => Promise<boolean> = async () => false

export function configureAuthClient(c: {
  getAccessToken: () => string | null
  refreshAccess: () => Promise<boolean>
}): void {
  getAccessToken = c.getAccessToken
  refreshAccess = c.refreshAccess
}

export function formatAuthApiError(err: unknown): string {
  if (err instanceof AuthApiError) {
    if (err.message.trim()) return err.message
    return err.code !== 'UNKNOWN' ? `${err.code}（HTTP ${err.httpStatus}）` : `请求失败（HTTP ${err.httpStatus}）`
  }
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return '请求超时，请确认认证服务已启动且网络可达'
    }
    return err.message
  }
  return '操作失败'
}

const AUTH_FETCH_TIMEOUT_MS = 45_000

async function fetchWithOptionalTimeout(url: string, reqInit: RequestInit): Promise<Response> {
  if (reqInit.signal) {
    return fetch(url, reqInit)
  }
  const c = new AbortController()
  const tid = window.setTimeout(() => c.abort(), AUTH_FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...reqInit, signal: c.signal })
  } finally {
    clearTimeout(tid)
  }
}

export async function authFetchJson<T>(
  path: string,
  init: RequestInit = {},
  options: { skipAuth?: boolean } = {}
): Promise<T> {
  const base = getAuthApiBaseUrl()
  if (!isAuthApiConfigured()) {
    throw new Error('未配置认证 API 地址：生产打包需在环境变量中注入 VITE_AUTH_API_BASE_URL（完整 URL、无尾部斜杠）')
  }

  const run = (token: string | null) => {
    const headers = new Headers(init.headers)
    const method = (init.method ?? 'GET').toUpperCase()
    if (!headers.has('Content-Type') && method !== 'GET' && method !== 'HEAD') {
      headers.set('Content-Type', 'application/json')
    }
    if (token && !options.skipAuth) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return fetchWithOptionalTimeout(`${base}${path}`, { ...init, headers })
  }

  let token = options.skipAuth ? null : getAccessToken()
  let res = await run(token)
  if (res.status === 401 && !options.skipAuth) {
    const ok = await refreshAccess()
    if (ok) {
      token = getAccessToken()
      res = await run(token)
    }
  }

  const text = await res.text()
  let raw: unknown
  if (text) {
    try {
      raw = JSON.parse(text) as unknown
    } catch {
      raw = null
    }
  } else {
    raw = null
  }

  if (!raw || typeof raw !== 'object' || !('ok' in raw)) {
    const status = res.status
    const fallback =
      !res.ok && status === 401
        ? '认证失败（未收到有效 JSON）。若长时间无响应，请确认 MySQL 已启动，且 backend/.env 中 MYSQL_HOST 使用 127.0.0.1（避免 localhost 在部分环境下挂起）'
        : !res.ok
          ? `请求失败（HTTP ${status}）`
          : '无效的响应'
    throw new AuthApiError('BAD_RESPONSE', res.ok ? '无效的响应' : fallback, status)
  }

  if (!(raw as { ok: boolean }).ok) {
    const err = raw as ApiErr
    throw new AuthApiError(
      err.error?.code ?? 'UNKNOWN',
      err.error?.message || '请求失败',
      res.status
    )
  }

  return (raw as ApiOk<T>).data
}

/** 以二进制 body POST（如 application/octet-stream），解析 `{ ok, data }`，支持 401 刷新后重试与上传进度 */
export async function authPostBinaryJson<T>(
  pathWithQuery: string,
  body: Blob,
  onProgress?: (loaded: number, total: number) => void
): Promise<T> {
  const base = getAuthApiBaseUrl()
  if (!isAuthApiConfigured()) {
    throw new Error('未配置认证 API 地址：生产打包需在环境变量中注入 VITE_AUTH_API_BASE_URL（完整 URL、无尾部斜杠）')
  }
  const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`
  const url = `${base}${path}`
  const noop = () => {}
  const run = (token: string | null) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' }
    if (token) headers.Authorization = `Bearer ${token}`
    return xhrPostWithProgress(url, body, headers, onProgress ?? noop)
  }

  const parseText = (text: string, httpStatus: number): T => {
    let raw: unknown
    if (text) {
      try {
        raw = JSON.parse(text) as unknown
      } catch {
        raw = null
      }
    } else {
      raw = null
    }
    if (!raw || typeof raw !== 'object' || !('ok' in raw)) {
      const fallback =
        !text && httpStatus === 401
          ? '认证失败（未收到有效 JSON）'
          : !text
            ? `请求失败（HTTP ${httpStatus}）`
            : '无效的响应'
      throw new AuthApiError('BAD_RESPONSE', fallback, httpStatus)
    }
    if (!(raw as { ok: boolean }).ok) {
      const err = raw as ApiErr
      throw new AuthApiError(err.error?.code ?? 'UNKNOWN', err.error?.message || '请求失败', httpStatus)
    }
    return (raw as ApiOk<T>).data
  }

  let token = getAccessToken()
  try {
    const text = await run(token)
    return parseText(text, 200)
  } catch (e) {
    if (e instanceof XhrHttpError && e.status === 401 && token) {
      const ok = await refreshAccess()
      if (ok) {
        token = getAccessToken()
        const text2 = await run(token)
        return parseText(text2, 200)
      }
      try {
        return parseText(e.responseText, e.status)
      } catch {
        throw new AuthApiError('UNAUTHORIZED', '未登录或令牌无效', 401)
      }
    }
    if (e instanceof XhrHttpError) {
      try {
        return parseText(e.responseText, e.status)
      } catch (inner) {
        if (inner instanceof AuthApiError) throw inner
      }
      throw new AuthApiError('UNKNOWN', e.message, e.status)
    }
    throw e
  }
}
