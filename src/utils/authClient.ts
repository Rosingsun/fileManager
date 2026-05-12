/** 与 Vite 默认 `localhost:5173` 同主机名，避免对 127.0.0.1 触发 Chromium 本地网络预检限制 */
const DEV_AUTH_API_DEFAULT = 'http://localhost:3847'

export function getAuthApiBaseUrl(): string {
  const raw = import.meta.env.VITE_AUTH_API_BASE_URL
  const trimmed = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : ''
  if (trimmed) return trimmed
  if (import.meta.env.DEV) return DEV_AUTH_API_DEFAULT
  return ''
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
    return err.message
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
  if (!base) {
    throw new Error('未配置认证 API 地址：开发可在根目录 .env.development 设置 VITE_AUTH_API_BASE_URL；生产打包需注入该变量')
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

  let raw: unknown
  try {
    raw = await res.json()
  } catch {
    raw = null
  }

  if (!raw || typeof raw !== 'object' || !('ok' in raw)) {
    throw new AuthApiError(
      'BAD_RESPONSE',
      res.ok ? '无效的响应' : `请求失败 (${res.status})`,
      res.status
    )
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
