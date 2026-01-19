import { contextBridge, ipcRenderer } from 'electron'
import type { OrganizeConfig, FileInfo } from '../../src/types'

// 暴露受保护的方法给渲染进程
console.log('[Preload] 开始初始化 electronAPI')
console.log('[Preload] 环境信息:', {
  contextIsolation: true,
  nodeIntegration: false,
  hasContextBridge: typeof contextBridge !== 'undefined',
  hasIpcRenderer: typeof ipcRenderer !== 'undefined'
})

// 检查必要的 Electron API 是否可用
if (typeof contextBridge === 'undefined') {
  console.error('[Preload] contextBridge 不可用！这不应该在 Electron 环境中发生。')
  throw new Error('contextBridge is not available')
}

if (typeof ipcRenderer === 'undefined') {
  console.error('[Preload] ipcRenderer 不可用！这不应该在 Electron 环境中发生。')
  throw new Error('ipcRenderer is not available')
}

try {
  const electronAPI = {
    // 文件系统操作
    openDirectory: (): Promise<string | null> => {
      console.log('[Preload] 调用 openDirectory')
      return ipcRenderer.invoke('dialog:openDirectory')
    },
    
    readDirectory: (path: string): Promise<FileInfo[]> => {
      console.log('[Preload] 调用 readDirectory:', path)
      return ipcRenderer.invoke('fs:readDirectory', path)
    },
    
    readDirectoryRecursive: (path: string): Promise<FileInfo[]> => {
      console.log('[Preload] 调用 readDirectoryRecursive:', path)
      return ipcRenderer.invoke('fs:readDirectoryRecursive', path)
    },
    
    organizeFiles: (config: OrganizeConfig): Promise<Array<{ from: string; to: string; success: boolean; error?: string }>> => {
      console.log('[Preload] 调用 organizeFiles:', config)
      return ipcRenderer.invoke('fs:organize', config)
    },
    
    extractFiles: (targetPath: string, extensions: string[], conflictAction: 'skip' | 'overwrite' | 'rename'): Promise<Array<{ from: string; to: string; success: boolean; error?: string }>> => {
      console.log('[Preload] 调用 extractFiles:', { targetPath, extensions, conflictAction })
      return ipcRenderer.invoke('fs:extractFiles', targetPath, extensions, conflictAction)
    },
    
    // 应用功能
    getAppVersion: (): Promise<string> => {
      return ipcRenderer.invoke('app:getVersion')
    },
    
    getPlatform: (): Promise<string> => {
      return ipcRenderer.invoke('app:getPlatform')
    },
    
    // 窗口控制
    minimizeWindow: (): void => {
      ipcRenderer.send('window:minimize')
    },
    
    maximizeWindow: (): void => {
      ipcRenderer.send('window:maximize')
    },
    
    closeWindow: (): void => {
      ipcRenderer.send('window:close')
    }
  }
  
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  
  console.log('[Preload] electronAPI 初始化成功')
  console.log('[Preload] 已暴露的方法:', Object.keys(electronAPI))
  
  // 验证是否成功暴露
  if ((globalThis as any).electronAPI) {
    console.log('[Preload] 验证: electronAPI 已成功暴露到 globalThis')
  } else {
    console.warn('[Preload] 警告: electronAPI 未在 globalThis 中找到')
  }
} catch (error: any) {
  console.error('[Preload] electronAPI 初始化失败:', error)
  console.error('[Preload] 错误详情:', {
    message: error.message,
    stack: error.stack,
    name: error.name
  })
  // 即使失败也尝试暴露一个空对象，避免渲染进程崩溃
  try {
    contextBridge.exposeInMainWorld('electronAPI', null)
  } catch (e) {
    console.error('[Preload] 无法暴露空 electronAPI:', e)
  }
}

// 类型声明（已在 src/types/electron.d.ts 中定义，这里不再重复声明）

