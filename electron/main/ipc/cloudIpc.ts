/**
 * 云盘相关 IPC Handler
 *
 * channel 前缀：cloud:*
 *   - cloud:listProviders             GET 可用 provider 列表
 *   - cloud:hasCredentials            是否已配置某 provider 凭证
 *   - cloud:setCredentials            写入凭证（已加密）
 *   - cloud:clearCredentials          清除凭证
 *   - cloud:validateCredentials       校验凭证是否有效（轻量调用）
 *   - cloud:list                       列出目录
 *   - cloud:mkdir                      新建文件夹
 *   - cloud:remove                     删除
 *   - cloud:rename                     重命名
 *   - cloud:move                       移动
 *   - cloud:getDownloadTicket          获取下载签名 URL
 *   - cloud:upload                     上传本地文件
 *   - cloud:openExternal              用默认浏览器打开 URL（用于在网页端查看云盘）
 *   - cloud:onUploadProgress           订阅上传进度（renderer -> main -> renderer）
 *   - cloud:isVaultAvailable           safeStorage 是否可用
 */

import { BrowserWindow, ipcMain, shell } from 'electron'
import { CloudError, getProvider, hasCredential, isVaultAvailable, listProviderInfos, maskCredential } from '../services/cloud'
import type { CloudProviderId, CloudUploadOptions, CloudUploadProgress } from '../services/cloud'

interface UploadInFlight {
  sessionId: string
  controller: AbortController
  filePath: string
  fileName: string
}

const activeUploads = new Map<string, UploadInFlight>()

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender) ?? null
}

function sendProgress(win: BrowserWindow | null, progress: CloudUploadProgress) {
  if (!win || win.isDestroyed()) return
  win.webContents.send('cloud:uploadProgress', progress)
}

function mapCloudError(e: unknown): { code: string; message: string; retryable: boolean } {
  if (e instanceof CloudError) {
    return { code: e.code, message: e.message, retryable: e.retryable }
  }
  if (e instanceof Error) {
    return { code: 'unknown', message: e.message, retryable: false }
  }
  return { code: 'unknown', message: String(e), retryable: false }
}

export function registerCloudIpc(): void {
  ipcMain.handle('cloud:listProviders', () => listProviderInfos())

  ipcMain.handle('cloud:isVaultAvailable', () => isVaultAvailable())

  ipcMain.handle('cloud:hasCredentials', async (_event, providerId: CloudProviderId) => {
    return hasCredential(providerId)
  })

  ipcMain.handle(
    'cloud:setCredentials',
    async (_event, providerId: CloudProviderId, raw: string) => {
      try {
        const p = getProvider(providerId)
        const { accountHint } = await p.setCredentials(raw)
        return { ok: true, accountHint, maskedToken: maskCredential(raw) }
      } catch (e) {
        return { ok: false, ...mapCloudError(e) }
      }
    }
  )

  ipcMain.handle('cloud:clearCredentials', async (_event, providerId: CloudProviderId) => {
    const p = getProvider(providerId)
    await p.clearCredentials()
    return { ok: true }
  })

  ipcMain.handle('cloud:validateCredentials', async (_event, providerId: CloudProviderId) => {
    const p = getProvider(providerId)
    return p.validateCredentials()
  })

  ipcMain.handle('cloud:list', async (_event, providerId: CloudProviderId, parentId: string, cursor?: string) => {
    try {
      const p = getProvider(providerId)
      return { ok: true, data: await p.list(parentId, cursor) }
    } catch (e) {
      return { ok: false, ...mapCloudError(e) }
    }
  })

  ipcMain.handle(
    'cloud:mkdir',
    async (_event, providerId: CloudProviderId, parentId: string, name: string) => {
      try {
        const p = getProvider(providerId)
        return { ok: true, data: await p.mkdir(parentId, name) }
      } catch (e) {
        return { ok: false, ...mapCloudError(e) }
      }
    }
  )

  ipcMain.handle('cloud:remove', async (_event, providerId: CloudProviderId, fileId: string) => {
    try {
      const p = getProvider(providerId)
      await p.remove(fileId)
      return { ok: true }
    } catch (e) {
      return { ok: false, ...mapCloudError(e) }
    }
  })

  ipcMain.handle('cloud:rename', async (_event, providerId: CloudProviderId, fileId: string, newName: string) => {
    try {
      const p = getProvider(providerId)
      await p.rename(fileId, newName)
      return { ok: true }
    } catch (e) {
      return { ok: false, ...mapCloudError(e) }
    }
  })

  ipcMain.handle(
    'cloud:move',
    async (_event, providerId: CloudProviderId, fileId: string, newParentId: string, newName?: string) => {
      try {
        const p = getProvider(providerId)
        await p.move(fileId, newParentId, newName)
        return { ok: true }
      } catch (e) {
        return { ok: false, ...mapCloudError(e) }
      }
    }
  )

  ipcMain.handle('cloud:getDownloadTicket', async (_event, providerId: CloudProviderId, fileId: string) => {
    try {
      const p = getProvider(providerId)
      return { ok: true, data: await p.getDownloadTicket(fileId) }
    } catch (e) {
      return { ok: false, ...mapCloudError(e) }
    }
  })

  ipcMain.handle(
    'cloud:upload',
    async (
      event,
      providerId: CloudProviderId,
      localPath: string,
      options: CloudUploadOptions,
      sessionId: string
    ) => {
      const win = senderWindow(event)
      const controller = new AbortController()
      const fileName = localPath.split(/[\\/]/).pop() ?? localPath
      const ticket: UploadInFlight = { sessionId, controller, filePath: localPath, fileName }
      activeUploads.set(sessionId, ticket)

      const onProgress = (progress: CloudUploadProgress) => {
        sendProgress(win, { ...progress, sessionId })
      }

      try {
        const p = getProvider(providerId)
        const result = await p.uploadFile(localPath, options ?? { parentId: 'root' }, onProgress, controller.signal)
        return { ok: true, data: result }
      } catch (e) {
        console.error('[cloud:upload] 上传失败', { providerId, localPath }, e instanceof Error ? e.stack ?? e.message : String(e))
        const mapped = mapCloudError(e)
        sendProgress(win, {
          sessionId,
          filePath: localPath,
          fileName,
          fileSize: 0,
          loaded: 0,
          percent: 0,
          status: 'failed',
          parentId: options?.parentId ?? 'root',
          error: mapped.message,
        })
        return { ok: false, ...mapped }
      } finally {
        activeUploads.delete(sessionId)
      }
    }
  )

  ipcMain.handle('cloud:cancelUpload', async (_event, sessionId: string) => {
    const ticket = activeUploads.get(sessionId)
    if (ticket) {
      ticket.controller.abort()
      activeUploads.delete(sessionId)
      return { ok: true, cancelled: true }
    }
    return { ok: true, cancelled: false }
  })

  ipcMain.handle('cloud:openExternal', async (_event, url: string) => {
    try {
      await shell.openExternal(url)
      return { ok: true }
    } catch (e) {
      return { ok: false, ...mapCloudError(e) }
    }
  })
}
