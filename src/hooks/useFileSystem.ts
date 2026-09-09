import { useCallback } from 'react'
import { message } from 'antd'
import { useFileStore } from '../stores/fileStore'
import { logSignedInUserAction } from '../utils'
import type { FileInfo, DirectoryPageRequest } from '../types'

/** 浏览分页的默认页大小（滚动加载「更多」每批条数） */
export const BROWSE_PAGE_SIZE = 60

const checkElectronAPI = () => {
  if (!window.electronAPI) {
    message.error('Electron API 未初始化，请确保在 Electron 环境中运行')
    return false
  }
  return true
}

const normalizePath = (path: string): string => path.replace(/\\/g, '/')

/** 惰性全量副本：记录同一目录正在进行的全量读取，避免并发重复触发 */
const allFilesInflight = new Map<string, Promise<FileInfo[] | null>>()

/**
 * 失效当前（或指定路径）的全量副本，使下一次 ensureAllFilesLoaded 重新拉取整目录。
 * 供文件变更（增删改/重命名/整理落地/提取等）后调用。
 */
export function invalidateAllFiles(): void {
  const s = useFileStore.getState()
  s.setAllFilesLoaded(false)
  s.setAllFilesPath(null)
  s.setFileList([])
}

/**
 * 惰性加载「必须看整目录」的全量副本并写入 store.fileList。
 * 仅当用户真正需要（整理/提取/图片分类筛选/预览整目录翻页/RAW·LivePhoto 判定/图片分析等）
 * 才调用，避免打开文件夹时一次性全量读取拖慢首屏。
 * 返回该目录的完整 FileInfo 列表；加载失败或 API 不可用返回 null。
 */
export async function ensureAllFilesLoaded(path: string): Promise<FileInfo[] | null> {
  if (!window.electronAPI) return null
  const normalizedPath = normalizePath(path)
  const s = useFileStore.getState()

  if (s.allFilesLoaded && s.allFilesPath === normalizedPath && s.fileList.length > 0) {
    return s.fileList
  }

  const inFlight = allFilesInflight.get(normalizedPath)
  if (inFlight) return inFlight

  s.setAllFilesLoading(true)
  const p = (async (): Promise<FileInfo[] | null> => {
    try {
      const files = await window.electronAPI!.readDirectory(normalizedPath)
      useFileStore.setState({
        fileList: files,
        allFilesLoaded: true,
        allFilesPath: normalizedPath,
        allFilesLoading: false
      })
      return files
    } catch (error: any) {
      useFileStore.setState({ allFilesLoading: false })
      console.error('加载整目录失败:', error)
      return null
    } finally {
      allFilesInflight.delete(normalizedPath)
    }
  })()

  allFilesInflight.set(normalizedPath, p)
  return p
}

/**
 * 分页读取目录首页/指定 offset 页（默认不带扩展名过滤，用于「无筛选」浏览态滚动增量加载）。
 * @param offset 基于稳定排序（文件夹在前→名称）的起始下标
 * @param opts extensions 可选扩展名过滤
 */
async function requestBrowsePage(path: string, offset: number, limit: number, extensions?: string[]): Promise<{
  items: FileInfo[]
  totalCount: number
  hasMore: boolean
}> {
  const normalizedPath = normalizePath(path)
  const api = window.electronAPI
  // 优先走主进程分页；旧版 preload 未提供 readDirectoryPage 时回退到全量读取 + 本地稳定排序切分，
  // 保证即使 preload 未重启（electron-vite 热更新不会重载 preload）也能正常浏览目录。
  if (api && typeof api.readDirectoryPage === 'function') {
    const req: DirectoryPageRequest = { offset, limit }
    if (extensions && extensions.length > 0) req.extensions = extensions
    return api.readDirectoryPage(normalizedPath, req)
  }

  const extSet = extensions && extensions.length > 0
    ? new Set(extensions.map((e) => e.toLowerCase()))
    : null
  const all = await api!.readDirectory(normalizedPath)
  console.warn('[useFileSystem] 当前 preload 缺少 readDirectoryPage，已回退全量读取本地切分；建议重启 Electron 使 preload 生效')
  const filtered = extSet
    ? all.filter((f) => {
        if (f.isDirectory) return true
        const dot = f.name.lastIndexOf('.')
        return dot > 0 && extSet.has(f.name.slice(dot + 1).toLowerCase())
      })
    : all
  const totalCount = filtered.length
  const slice = filtered.slice(offset, offset + limit)
  // readDirectory 已返回全量且本地可排序；切片保持稳定顺序即可
  return { items: slice, totalCount, hasMore: offset + slice.length < totalCount }
}

/**
 * 滚动到底「加载更多」：在当前浏览片段之后追加服务端下一页（默认浏览态专用）。
 * 带路径/结束/加载中竞态保护；模块级导出便于 useBrowsing 与 useFileSystem 复用。
 */
/** 单次浏览会话内最多累计展示的条目上限，防止无虚拟化网格/表格 DOM 失控（可进入子目录缩小范围） */
const BROWSE_LOAD_CAP = 1200

export async function loadBrowseMorePage(path: string, limit: number = BROWSE_PAGE_SIZE): Promise<void> {
  if (!window.electronAPI) return
  const normalizedPath = normalizePath(path)
  const store = useFileStore.getState()

  if (store.browsePath !== normalizedPath || store.browseDone || store.browseLoading) return

  const offset = store.browseItems.length
  if (offset >= BROWSE_LOAD_CAP) {
    // 已达单次浏览上限：标记加载结束，避免无限追加导致渲染卡顿
    store.setBrowseDone(true)
    return
  }

  store.setBrowseLoading(true)
  try {
    const page = await requestBrowsePage(normalizedPath, offset, limit)
    store.appendBrowse(page.items)
  } catch (error: any) {
    message.error(`加载更多失败: ${error.message}`)
    store.setBrowseDone(true)
  } finally {
    const cur = useFileStore.getState()
    if (cur.browseLoading) cur.setBrowseLoading(false)
  }
}

export function useFileSystem() {
  const loadDirectory = useCallback(
    async (
      path: string,
      addToHistory: boolean = true,
      opts: { limit?: number; extensions?: string[] } = {}
    ) => {
      if (!checkElectronAPI()) return

      const normalizedPath = normalizePath(path)
      const store = useFileStore.getState()
      const limit = opts.limit ?? BROWSE_PAGE_SIZE

      // 目录切换：重置浏览态并失效旧的全量副本，仅请求首页切片，避免一次读取全目录
      store.resetBrowse()
      store.setLoading(true)
      try {
        const page = await requestBrowsePage(normalizedPath, 0, limit, opts.extensions)
        store.setBrowseFirst(normalizedPath, page.items, page.totalCount)
        store.setCurrentPath(normalizedPath)
        invalidateAllFiles()
        if (addToHistory) store.addHistory(normalizedPath)
      } catch (error: any) {
        message.error(`加载目录失败: ${error.message}`)
        useFileStore.getState().resetDirectory()
      } finally {
        useFileStore.getState().setLoading(false)
      }
    },
    []
  )

  /** 滚动到底「加载更多」：在当前浏览片段之后追加服务端下一页（默认浏览态专用） */
  const loadBrowseMore = useCallback(async (path: string, limit: number = BROWSE_PAGE_SIZE) => {
    if (!checkElectronAPI()) return
    await loadBrowseMorePage(path, limit)
  }, [])

  const selectDirectory = useCallback(async () => {
    if (!checkElectronAPI()) return

    try {
      const path = await window.electronAPI!.openDirectory()
      if (path) {
        const normalizedPath = normalizePath(path)
        await loadDirectory(normalizedPath)
        message.success('目录选择成功')
        logSignedInUserAction('directory_selected', '选择工作目录', normalizedPath)
      }
    } catch (error: any) {
      message.error(`选择目录失败: ${error.message}`)
    }
  }, [loadDirectory])

  const loadDirectoryFromHistory = useCallback(
    async (path: string) => {
      await loadDirectory(normalizePath(path))
    },
    [loadDirectory]
  )

  const loadRecursiveDirectoryForPreview = useCallback(async (path: string) => {
    if (!checkElectronAPI()) {
      throw new Error('Electron API 未初始化')
    }

    try {
      const store = useFileStore.getState()
      store.setLoading(true)
      const normalizedPath = normalizePath(path)
      return await window.electronAPI!.readDirectoryRecursive(normalizedPath)
    } catch (error: any) {
      message.error(`递归加载目录失败: ${error.message}`)
      throw error
    } finally {
      useFileStore.getState().setLoading(false)
    }
  }, [])

  const extractFiles = useCallback(
    async (
      targetPath: string,
      filters: { extensions: string[]; minSize?: number; maxSize?: number; category?: string },
      conflictAction: 'skip' | 'overwrite' | 'rename' = 'rename'
    ) => {
      if (!checkElectronAPI()) return

      try {
        const store = useFileStore.getState()
        store.setLoading(true)
        const normalizedPath = normalizePath(targetPath)
        const results = await window.electronAPI!.extractFiles(normalizedPath, filters, conflictAction)

        const successCount = results.filter(r => r.success).length
        const failCount = results.length - successCount

        if (results.length === 0) {
          message.info('未找到匹配的文件')
        } else if (failCount > 0) {
          message.warning(`提取完成：成功 ${successCount} 个，失败 ${failCount} 个`)
        } else {
          message.success(`成功提取 ${successCount} 个文件`)
        }
        if (results.length > 0) {
          logSignedInUserAction(
            'file_extract',
            `文件提取（成功 ${successCount}，失败 ${failCount}）`,
            normalizedPath
          )
        }

        await loadDirectory(normalizedPath)
        return results
      } catch (error: any) {
        message.error(`提取文件失败: ${error.message}`)
        throw error
      } finally {
        useFileStore.getState().setLoading(false)
      }
    },
    [loadDirectory]
  )

  return {
    selectDirectory,
    loadDirectory,
    loadDirectoryFromHistory,
    loadBrowseMore,
    loadRecursiveDirectoryForPreview,
    extractFiles,
    ensureAllFilesLoaded,
    invalidateAllFiles
  }
}
