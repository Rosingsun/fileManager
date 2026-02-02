import { useCallback } from 'react'
import { message } from 'antd'
import { useFileStore } from '../stores/fileStore'

const checkElectronAPI = () => {
  if (!window.electronAPI) {
    message.error('Electron API 未初始化，请确保在 Electron 环境中运行')
    return false
  }
  return true
}

const normalizePath = (path: string): string => path.replace(/\\/g, '/')

export function useFileSystem() {
  const { setCurrentPath, setFileList, setLoading, addHistory } = useFileStore()

  const loadDirectory = useCallback(async (path: string, addToHistory: boolean = true) => {
    if (!checkElectronAPI()) return

    try {
      setLoading(true)
      const normalizedPath = normalizePath(path)
      const files = await window.electronAPI!.readDirectory(normalizedPath)
      setFileList(files)
      setCurrentPath(normalizedPath)
      if (addToHistory) addHistory(normalizedPath)
    } catch (error: any) {
      message.error(`加载目录失败: ${error.message}`)
      setFileList([])
    } finally {
      setLoading(false)
    }
  }, [setFileList, setLoading, setCurrentPath, addHistory])

  const selectDirectory = useCallback(async () => {
    if (!checkElectronAPI()) return

    try {
      const path = await window.electronAPI!.openDirectory()
      if (path) {
        const normalizedPath = normalizePath(path)
        await loadDirectory(normalizedPath)
        message.success('目录选择成功')
      }
    } catch (error: any) {
      message.error(`选择目录失败: ${error.message}`)
    }
  }, [loadDirectory])

  const loadDirectoryFromHistory = useCallback(async (path: string) => {
    await loadDirectory(normalizePath(path))
  }, [loadDirectory])

  const loadRecursiveDirectoryForPreview = useCallback(async (path: string) => {
    if (!checkElectronAPI()) {
      throw new Error('Electron API 未初始化')
    }

    try {
      setLoading(true)
      const normalizedPath = normalizePath(path)
      return await window.electronAPI!.readDirectoryRecursive(normalizedPath)
    } catch (error: any) {
      message.error(`递归加载目录失败: ${error.message}`)
      throw error
    } finally {
      setLoading(false)
    }
  }, [setLoading])

  const extractFiles = useCallback(async (
    targetPath: string,
    extensions: string[],
    conflictAction: 'skip' | 'overwrite' | 'rename' = 'rename'
  ) => {
    if (!checkElectronAPI()) return

    try {
      setLoading(true)
      const normalizedPath = normalizePath(targetPath)
      const results = await window.electronAPI!.extractFiles(normalizedPath, extensions, conflictAction)
      
      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount
      
      if (results.length === 0) {
        message.info('未找到匹配的文件')
      } else if (failCount > 0) {
        message.warning(`提取完成：成功 ${successCount} 个，失败 ${failCount} 个`)
      } else {
        message.success(`成功提取 ${successCount} 个文件`)
      }
      
      await loadDirectory(normalizedPath)
      return results
    } catch (error: any) {
      message.error(`提取文件失败: ${error.message}`)
      throw error
    } finally {
      setLoading(false)
    }
  }, [loadDirectory, setLoading])

  return {
    selectDirectory,
    loadDirectory,
    loadDirectoryFromHistory,
    loadRecursiveDirectoryForPreview,
    extractFiles
  }
}

