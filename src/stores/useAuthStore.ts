import { create } from 'zustand'
import { authFetchJson, configureAuthClient, isAuthApiConfigured, appendOperationLog } from '../utils'

const SESSION_REFRESH_KEY = 'filedeal_auth_refresh'

async function loadStoredRefresh(): Promise<string | null> {
  const api = window.electronAPI
  try {
    if (api?.loadRefreshToken) {
      const t = await api.loadRefreshToken()
      if (t) return t
    }
  } catch {
    /* ignore */
  }
  try {
    return sessionStorage.getItem(SESSION_REFRESH_KEY)
  } catch {
    return null
  }
}

async function saveStoredRefresh(token: string): Promise<boolean> {
  const api = window.electronAPI
  if (api?.saveRefreshToken) {
    try {
      const r = await api.saveRefreshToken(token)
      if (r.ok) {
        try {
          sessionStorage.removeItem(SESSION_REFRESH_KEY)
        } catch {
          /* ignore */
        }
        return true
      }
      if (r.error !== 'encryption_unavailable') {
        return false
      }
    } catch {
      /* IPC 未注册或主进程异常时降级到 sessionStorage */
    }
  }
  try {
    sessionStorage.setItem(SESSION_REFRESH_KEY, token)
    return true
  } catch {
    return false
  }
}

async function clearStoredRefresh(): Promise<void> {
  await window.electronAPI?.clearRefreshToken?.()
  try {
    sessionStorage.removeItem(SESSION_REFRESH_KEY)
  } catch {
    /* ignore */
  }
}

export interface AuthUser {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  createdAt?: number
  invitedByUserId?: string | null
  isAdmin?: boolean
}

interface AuthTokensResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  isHydrating: boolean
  hydrateFromRefresh: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string, inviteCode?: string) => Promise<void>
  /** 库中无任何用户且后端已配置 BOOTSTRAP_INVITE_SECRET 时可用 */
  bootstrapFirstUser: (secret: string, email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  tryRefresh: () => Promise<boolean>
  fetchProfile: () => Promise<void>
  updateProfile: (patch: { displayName?: string; avatarUrl?: string | null }) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  isHydrating: false,

  hydrateFromRefresh: async () => {
    if (!isAuthApiConfigured()) return
    set({ isHydrating: true })
    try {
      const ok = await get().tryRefresh()
      if (ok) {
        const u = get().user
        if (u) void appendOperationLog(u.id, 'session_restored', '从本地恢复登录会话')
      }
    } finally {
      set({ isHydrating: false })
    }
  },

  tryRefresh: async () => {
    const rt = await loadStoredRefresh()
    if (!rt) return false
    try {
      const data = await authFetchJson<AuthTokensResponse>(
        '/auth/refresh',
        { method: 'POST', body: JSON.stringify({ refreshToken: rt }) },
        { skipAuth: true }
      )
      const ok = await saveStoredRefresh(data.refreshToken)
      if (!ok) return false
      set({ accessToken: data.accessToken, user: data.user })
      return true
    } catch {
      return false
    }
  },

  login: async (email: string, password: string) => {
    const data = await authFetchJson<AuthTokensResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      { skipAuth: true }
    )
    const ok = await saveStoredRefresh(data.refreshToken)
    if (!ok) {
      throw new Error('无法保存登录状态')
    }
    set({ accessToken: data.accessToken, user: data.user })
    void appendOperationLog(data.user.id, 'login', '登录成功')
  },

  register: async (email: string, password: string, displayName?: string, inviteCode?: string) => {
    const body: { email: string; password: string; displayName?: string; inviteCode?: string } = {
      email,
      password,
    }
    if (displayName?.trim()) body.displayName = displayName.trim()
    if (inviteCode?.trim()) body.inviteCode = inviteCode.trim()
    const data = await authFetchJson<AuthTokensResponse>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(body) },
      { skipAuth: true }
    )
    const ok = await saveStoredRefresh(data.refreshToken)
    if (!ok) {
      throw new Error('无法保存登录状态')
    }
    set({ accessToken: data.accessToken, user: data.user })
    void appendOperationLog(data.user.id, 'register', '注册并登录成功')
  },

  bootstrapFirstUser: async (secret: string, email: string, password: string, displayName?: string) => {
    const body: { secret: string; email: string; password: string; displayName?: string } = {
      secret,
      email,
      password,
    }
    if (displayName?.trim()) body.displayName = displayName.trim()
    const data = await authFetchJson<AuthTokensResponse>(
      '/auth/bootstrap-first-user',
      { method: 'POST', body: JSON.stringify(body) },
      { skipAuth: true }
    )
    const ok = await saveStoredRefresh(data.refreshToken)
    if (!ok) {
      throw new Error('无法保存登录状态')
    }
    set({ accessToken: data.accessToken, user: data.user })
    void appendOperationLog(data.user.id, 'bootstrap_first_user', '通过引导创建首个账号并登录')
  },

  logout: async () => {
    const uid = get().user?.id
    const rt = await loadStoredRefresh()
    try {
      if (rt && isAuthApiConfigured()) {
        await authFetchJson(
          '/auth/logout',
          { method: 'POST', body: JSON.stringify({ refreshToken: rt }) },
          { skipAuth: true }
        )
      }
    } catch {
      /* 仍清理本地 */
    }
    await clearStoredRefresh()
    if (uid) void appendOperationLog(uid, 'logout', '主动退出登录')
    set({ accessToken: null, user: null })
  },

  fetchProfile: async () => {
    const user = await authFetchJson<AuthUser>('/users/me', { method: 'GET' })
    set({ user })
  },

  updateProfile: async (patch) => {
    const user = await authFetchJson<AuthUser>('/users/me', {
      method: 'POST',
      body: JSON.stringify(patch),
    })
    set({ user })
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const uid = get().user?.id
    await authFetchJson<{ ok: true }>(
      '/users/me/password',
      {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }
    )
    await clearStoredRefresh()
    if (uid) void appendOperationLog(uid, 'password_changed', '登录密码已修改，会话已失效')
    set({ accessToken: null, user: null })
  },
}))

configureAuthClient({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccess: () => useAuthStore.getState().tryRefresh(),
})
