import { useCallback } from 'react'
import { message } from 'antd'
import { useFileStore } from '../stores/fileStore'

export function useFileSystem() {
  const { setCurrentPath, setFileList, setLoading } = useFileStore()

  // 选择目录
  const selectDirectory = useCallback(async () => {
    try {
      if (!window.electronAPI) {
        message.error('Electron API 未初始化，请确保在 Electron 环境中运行')
        return
      }
      const path = await window.electronAPI.openDirectory()
      if (path) {
        setCurrentPath(path)
        await loadDirectory(path)
        message.success('目录选择成功')
      }
    } catch (error: any) {
      message.error(`选择目录失败: ${error.message}`)
    }
  }, [setCurrentPath])

  // 加载目录内容
  const loadDirectory = useCallback(async (path: string) => {
    try {
      if (!window.electronAPI) {
        message.error('Electron API 未初始化，请确保在 Electron 环境中运行')
        return
      }
      setLoading(true)
      const files = await window.electronAPI.readDirectory(path)
      setFileList(files)
    } catch (error: any) {
      message.error(`加载目录失败: ${error.message}`)
      setFileList([])
    } finally {
      setLoading(false)
    }
  }, [setFileList, setLoading])

  return {
    selectDirectory,
    loadDirectory
  }
}

