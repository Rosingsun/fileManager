/**
 * 云盘 Provider 凭证保险箱
 *
 * - 使用 Electron safeStorage 加密落盘
 * - 存储位置：app.getPath('userData') / cloud-credentials / <provider>.enc
 * - 与现有 auth:saveRefreshToken（业务后端用户 token）物理隔离，避免互相覆盖
 * - 提供进程内的内存缓存，避免每次操作都做 decrypt
 *
 * 重要：safeStorage 依赖 OS 密钥链（macOS Keychain / Windows DPAPI / Linux kwallet），
 * 卸载/重装系统后旧凭证不可恢复。
 */

import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { CloudProviderId } from './types'

interface CachedVault {
  raw: string
  loadedAt: number
}

const memoryCache = new Map<CloudProviderId, CachedVault>()

function vaultDir(): string {
  return join(app.getPath('userData'), 'cloud-credentials')
}

function vaultPath(provider: CloudProviderId): string {
  return join(vaultDir(), `${provider}.enc`)
}

function ensureVaultDir(): void {
  const dir = vaultDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function isVaultAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function saveCredential(provider: CloudProviderId, raw: string): { ok: boolean; error?: string } {
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: '当前系统未提供加密能力，无法安全保存云盘凭证' }
  }
  try {
    const trimmed = raw.trim()
    if (!trimmed) {
      return { ok: false, error: '凭证不能为空' }
    }
    ensureVaultDir()
    const buf = safeStorage.encryptString(trimmed)
    writeFileSync(vaultPath(provider), buf)
    memoryCache.set(provider, { raw: trimmed, loadedAt: Date.now() })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export function loadCredential(provider: CloudProviderId): string | null {
  const cached = memoryCache.get(provider)
  if (cached) return cached.raw
  if (!safeStorage.isEncryptionAvailable()) return null
  const p = vaultPath(provider)
  if (!existsSync(p)) return null
  try {
    const buf = readFileSync(p)
    const raw = safeStorage.decryptString(buf)
    memoryCache.set(provider, { raw, loadedAt: Date.now() })
    return raw
  } catch (e) {
    console.error('[cloudVault] decrypt failed', provider, e)
    return null
  }
}

export function clearCredential(provider: CloudProviderId): void {
  memoryCache.delete(provider)
  const p = vaultPath(provider)
  if (existsSync(p)) {
    try {
      unlinkSync(p)
    } catch (e) {
      console.error('[cloudVault] clear failed', provider, e)
    }
  }
}

export function hasCredential(provider: CloudProviderId): boolean {
  if (memoryCache.has(provider)) return true
  return existsSync(vaultPath(provider))
}

export function maskCredential(raw: string): string {
  if (!raw) return ''
  if (raw.length <= 8) return raw[0] + '***'
  return `${raw.slice(0, 4)}***${raw.slice(-4)}`
}
