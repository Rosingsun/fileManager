import { useCallback } from 'react'
import { message } from 'antd'
import { useFileStore } from '../stores/fileStore'

export function useFileSystem() {
  const { setCurrentPath, setFileList, setLoading, addHistory } = useFileStore()

  // 加载目录内容
  const loadDirectory = useCallback(async (path: string, addToHistory: boolean = true) => {
    try {
      if (!window.electronAPI) {
        message.error('Electron API 未初始化，请确保在 Electron 环境中运行')
        return
      }
      setLoading(true)
      const normalizedPath = path.replace(/\\/g, '/') // 统一路径分隔符
      const files = await window.electronAPI.readDirectory(normalizedPath)
      setFileList(files)
      setCurrentPath(normalizedPath)
      if (addToHistory) {
        addHistory(normalizedPath) // 添加或更新历史记录
      }
    } catch (error: any) {
      message.error(`加载目录失败: ${error.message}`)
      setFileList([])
    } finally {
      setLoading(false)
    }
  }, [setFileList, setLoading, setCurrentPath, addHistory])

  // 选择目录
  const selectDirectory = useCallback(async () => {
    try {
      if (!window.electronAPI) {
        message.error('Electron API 未初始化，请确保在 Electron 环境中运行')
        return
      }
      const path = await window.electronAPI.openDirectory()
      if (path) {
        const normalizedPath = path.replace(/\\/g, '/') // 统一路径分隔符
        await loadDirectory(normalizedPath)
        message.success('目录选择成功')
      }
    } catch (error: any) {
      message.error(`选择目录失败: ${error.message}`)
    }
  }, [loadDirectory])

  // 从历史记录加载目录
  const loadDirectoryFromHistory = useCallback(async (path: string) => {
    const normalizedPath = path.replace(/\\/g, '/') // 统一路径分隔符
    await loadDirectory(normalizedPath)
  }, [loadDirectory])

  // 递归加载目录内容用于预览
  const loadRecursiveDirectoryForPreview = useCallback(async (path: string) => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API 未初始化，请确保在 Electron 环境中运行')
      }
      setLoading(true)
      const normalizedPath = path.replace(/\\/g, '/') // 统一路径分隔符
      const files = await window.electronAPI.readDirectoryRecursive(normalizedPath)
      return files
    } catch (error: any) {
      message.error(`递归加载目录失败: ${error.message}`)
      throw error
    } finally {
      setLoading(false)
    }
  }, [setLoading])

  // 提取文件（将子目录中的指定类型文件提取到当前目录）
  const extractFiles = useCallback(async (
    targetPath: string,
    extensions: string[],
    conflictAction: 'skip' | 'overwrite' | 'rename' = 'rename'
  ) => {
    try {
      if (!window.electronAPI) {
        message.error('Electron API 未初始化，请确保在 Electron 环境中运行')
        return
      }
      setLoading(true)
      const normalizedPath = targetPath.replace(/\\/g, '/') // 统一路径分隔符
      const results = await window.electronAPI.extractFiles(normalizedPath, extensions, conflictAction)
      
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      
      if (results.length === 0) {
        message.info('未找到匹配的文件')
      } else if (failCount > 0) {
        message.warning(`提取完成：成功 ${successCount} 个，失败 ${failCount} 个`)
      } else {
        message.success(`成功提取 ${successCount} 个文件`)
      }
      
      // 重新加载目录
      await loadDirectory(normalizedPath)
      
      return results
    } catch (error: any) {
      message.error(`提取文件失败: ${error.message}`)
      throw error
    } finally {
      setLoading(false)
    }
  }, [setLoading, loadDirectory])

  return {
    selectDirectory,
    loadDirectory,
    loadDirectoryFromHistory,
    loadRecursiveDirectoryForPreview,
    extractFiles
  }
}

