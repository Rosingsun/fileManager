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
      console.log('[Preload] Calling openDirectory')
      return ipcRenderer.invoke('dialog:openDirectory')
    },
    
    readDirectory: (path: string): Promise<FileInfo[]> => {
      return ipcRenderer.invoke('fs:readDirectory', path)
    },
    
    readDirectoryRecursive: (path: string): Promise<FileInfo[]> => {
      return ipcRenderer.invoke('fs:readDirectoryRecursive', path)
    },
    
    organizeFiles: (config: OrganizeConfig): Promise<Array<{ from: string; to: string; success: boolean; error?: string }>> => {
      return ipcRenderer.invoke('fs:organize', config)
    },
    
    extractFiles: (targetPath: string, extensions: string[], conflictAction: 'skip' | 'overwrite' | 'rename'): Promise<Array<{ from: string; to: string; success: boolean; error?: string }>> => {
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
    },
    
    // 文件预览
    previewFile: (filePath: string, fileList?: import('../../src/types').FileInfo[], currentIndex?: number): void => {
      ipcRenderer.send('file:preview', filePath, fileList, currentIndex)
    },

    // 文件重命名
    renameFile: (oldPath: string, newName: string): Promise<boolean> => {
      return ipcRenderer.invoke('file:rename', oldPath, newName)
    },

    // 删除文件或文件夹
    deleteFile: (filePath: string): Promise<boolean> => {
      return ipcRenderer.invoke('file:delete', filePath)
    },

    // 移动文件或文件夹
    moveFile: (oldPath: string, newPath: string): Promise<boolean> => {
      return ipcRenderer.invoke('file:move', oldPath, newPath)
    },

    // 获取图片base64用于预览
    getImageBase64: (filePath: string): Promise<string> => {
      return ipcRenderer.invoke('file:getImageBase64', filePath)
    },

    // 获取图片缩略图base64用于预览
    getImageThumbnail: (filePath: string, size?: number, quality?: number): Promise<string> => {
      return ipcRenderer.invoke('file:getImageThumbnail', filePath, size, quality)
    },
    
    // 打开文件
    openFile: (filePath: string): Promise<boolean> => {
      return ipcRenderer.invoke('file:open', filePath)
    },

    // 相似照片检测
    scanSimilarImages: (config: import('../../src/types').SimilarityScanConfig): Promise<import('../../src/types').SimilarityScanResult> => {
      return ipcRenderer.invoke('similarity:scan', config)
    },

    onSimilarityScanProgress: (callback: (progress: import('../../src/types').SimilarityScanProgress) => void): (() => void) => {
      const handler = (_event: any, progress: import('../../src/types').SimilarityScanProgress) => {
        callback(progress)
      }
      ipcRenderer.on('similarity:progress', handler)
      return () => {
        ipcRenderer.removeListener('similarity:progress', handler)
      }
    },

    cancelSimilarityScan: (): void => {
      ipcRenderer.send('similarity:cancel')
    }
  }
  
  console.log('[Preload] About to expose electronAPI to main world')
  console.log('[Preload] electronAPI object keys:', Object.keys(electronAPI))
  
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  console.log('[Preload] electronAPI exposed successfully')
  
  // 验证暴露是否成功
  setTimeout(() => {
    console.log('[Preload] Checking if electronAPI is available in globalThis:', typeof (globalThis as any).electronAPI)
    if ((globalThis as any).electronAPI) {
      console.log('[Preload] electronAPI methods:', Object.keys((globalThis as any).electronAPI))
    }
  }, 100)
} catch (error: any) {
  console.error('[Preload] Failed to expose electronAPI:', error)
  // 即使失败也尝试暴露一个空对象，避免渲染进程崩溃
  try {
    contextBridge.exposeInMainWorld('electronAPI', {})
  } catch (e) {
    console.error('[Preload] Could not expose fallback electronAPI:', e)
  }
}

// 类型声明（已在 src/types/electron.d.ts 中定义，这里不再重复声明）

