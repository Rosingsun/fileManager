import { useCallback } from 'react'
import { useFileStore } from '../stores'
import { loadBrowseMorePage, BROWSE_PAGE_SIZE } from './useFileSystem'
import type { FileInfo } from '../types'

export interface BrowsingState {
  /** 已从服务端分页加载的累计片段（仅「无筛选」默认浏览态使用） */
  items: FileInfo[]
  /** 过滤后（无筛选时为目录）条目总数 */
  total: number
  /** 是否正在加载下一页 */
  loading: boolean
  /** 是否已全部加载（无更多可追加） */
  done: boolean
  /** 当前浏览的目录路径 */
  path: string | null
  /** 触发滚动到底加载下一页 */
  loadMore: () => Promise<void>
}

/**
 * 默认浏览态的分页滚动 hook：订阅 store 中的 browse 片段，
 * 提供滚动到底「加载更多」能力（含竞态保护：路径变化/加载中/已结束时忽略追加）。
 * 仅供 FileList「无任何筛选」的浏览主视图使用；筛选态由 FileList 走惰性全量副本。
 */
export function useBrowsing(): BrowsingState {
  const browseItems = useFileStore((s) => s.browseItems)
  const browseTotal = useFileStore((s) => s.browseTotal)
  const browseLoading = useFileStore((s) => s.browseLoading)
  const browseDone = useFileStore((s) => s.browseDone)
  const browsePath = useFileStore((s) => s.browsePath)

  const loadMore = useCallback(async () => {
    if (!browsePath) return
    await loadBrowseMorePage(browsePath, BROWSE_PAGE_SIZE)
  }, [browsePath])

  return {
    items: browseItems,
    total: browseTotal,
    loading: browseLoading,
    done: browseDone,
    path: browsePath,
    loadMore
  }
}
