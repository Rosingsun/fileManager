import { create } from 'zustand'
import type { FileInfo, OrganizeConfig, TreeNode, PreviewResultItem, HistoryItem, SizeRange, FileCategory } from '../types'

const HISTORY_STORAGE_KEY = 'filedeal_history'
const SIZE_RANGES_STORAGE_KEY = 'filedeal_size_ranges'

export interface FileFilterState {
  selectedCategory: FileCategory | 'all'
  selectedSubExtensions: string[]
  setSelectedCategory: (category: FileCategory | 'all') => void
  setSelectedSubExtensions: (extensions: string[]) => void
  resetFilter: () => void
}

export const FILE_CATEGORIES: { key: FileCategory | 'all'; label: string; extensions: string[] }[] = [
  { key: 'all', label: '全部', extensions: [] },
  { key: 'image', label: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'raw'] },
  { key: 'video', label: '视频', extensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', '3gp'] },
  { key: 'audio', label: '音频', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'ape'] },
  { key: 'document', label: '文档', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf'] },
  { key: 'archive', label: '压缩文件', extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'] },
  { key: 'other', label: '其他', extensions: [] }
]

const DEFAULT_SIZE_RANGES: SizeRange[] = [
  { id: '1', name: '小文件', minSize: 0, maxSize: 10 * 1024 * 1024 },
  { id: '2', name: '中等文件', minSize: 10 * 1024 * 1024, maxSize: 100 * 1024 * 1024 },
  { id: '3', name: '大文件', minSize: 100 * 1024 * 1024, maxSize: Number.MAX_SAFE_INTEGER }
]

const safeStorage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  },
  set: <T>(key: string, value: T): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }
}

interface FileStore {
  // 当前选择的目录路径
  currentPath: string | null
  setCurrentPath: (path: string | null) => void

  // 当前目录的文件列表
  fileList: FileInfo[]
  setFileList: (files: FileInfo[]) => void
  loading: boolean
  setLoading: (loading: boolean) => void

  // 文件树数据
  treeData: TreeNode[]
  setTreeData: (data: TreeNode[]) => void

  // 整理配置
  organizeConfig: OrganizeConfig | null
  setOrganizeConfig: (config: OrganizeConfig | null) => void

  // 预览结果
  previewResults: PreviewResultItem[]
  setPreviewResults: (results: PreviewResultItem[]) => void

  // 预览视图模式
  previewViewMode: 'list' | 'tree' | 'grid'
  setPreviewViewMode: (mode: 'list' | 'tree' | 'grid') => void

  // 历史记录
  historyList: HistoryItem[]
  addHistory: (path: string) => void
  removeHistory: (id: string) => void
  clearHistory: () => void
  loadHistoryFromStorage: () => void

  // 文件大小分类范围
  sizeRanges: SizeRange[]
  addSizeRange: (range: Omit<SizeRange, 'id'>) => boolean
  updateSizeRange: (id: string, range: Partial<SizeRange>) => boolean
  deleteSizeRange: (id: string) => boolean
  resetSizeRanges: () => void

  // 文件筛选状态
  selectedCategory: FileCategory | 'all'
  selectedSubExtensions: string[]
  setSelectedCategory: (category: FileCategory | 'all') => void
  setSelectedSubExtensions: (extensions: string[]) => void
  resetFilter: () => void
}

export const useFileStore = create<FileStore>((set, get) => ({
  currentPath: null,
  setCurrentPath: (path) => set({ currentPath: path }),

  fileList: [],
  setFileList: (files) => set({ fileList: files }),
  loading: false,
  setLoading: (loading) => set({ loading }),

  treeData: [],
  setTreeData: (data) => set({ treeData: data }),

  organizeConfig: null,
  setOrganizeConfig: (config) => set({ organizeConfig: config }),

  previewResults: [],
  setPreviewResults: (results: PreviewResultItem[]) => set({ previewResults: results }),

  previewViewMode: 'list',
  setPreviewViewMode: (mode: 'list' | 'tree' | 'grid') => set({ previewViewMode: mode }),

  historyList: safeStorage.get(HISTORY_STORAGE_KEY, []),
  addHistory: (path: string) => {
    const { historyList } = get()
    const normalizedPath = path.replace(/\\/g, '/')
    const name = normalizedPath.split('/').pop() || normalizedPath
    const existingIndex = historyList.findIndex(item => item.path === normalizedPath)

    if (existingIndex >= 0) {
      const newList = [...historyList]
      newList[existingIndex] = { ...newList[existingIndex], timestamp: Date.now() }
      set({ historyList: newList })
      safeStorage.set(HISTORY_STORAGE_KEY, newList)
    } else {
      const newHistoryItem: HistoryItem = { id: normalizedPath, path: normalizedPath, name, timestamp: Date.now() }
      const newList = [newHistoryItem, ...historyList]
      set({ historyList: newList })
      safeStorage.set(HISTORY_STORAGE_KEY, newList)
    }
  },
  removeHistory: (id: string) => {
    const { historyList } = get()
    const newList = historyList.filter(item => item.id !== id)
    set({ historyList: newList })
    safeStorage.set(HISTORY_STORAGE_KEY, newList)
  },
  clearHistory: () => {
    set({ historyList: [] })
    safeStorage.set(HISTORY_STORAGE_KEY, [])
  },
  loadHistoryFromStorage: () => {
    set({ historyList: safeStorage.get(HISTORY_STORAGE_KEY, []) })
  },

  sizeRanges: safeStorage.get(SIZE_RANGES_STORAGE_KEY, DEFAULT_SIZE_RANGES),
  addSizeRange: (range: Omit<SizeRange, 'id'>) => {
    const { sizeRanges } = get()
    if (sizeRanges.length >= 5) return false

    const hasOverlap = sizeRanges.some(existing =>
      range.minSize < existing.maxSize && range.maxSize > existing.minSize
    )
    if (hasOverlap) return false

    const newRange: SizeRange = { ...range, id: Date.now().toString() }
    const newRanges = [...sizeRanges, newRange].sort((a, b) => a.minSize - b.minSize)
    set({ sizeRanges: newRanges })
    safeStorage.set(SIZE_RANGES_STORAGE_KEY, newRanges)
    return true
  },
  updateSizeRange: (id: string, updates: Partial<SizeRange>) => {
    const { sizeRanges } = get()
    const index = sizeRanges.findIndex(r => r.id === id)
    if (index === -1) return false

    const updatedRange = { ...sizeRanges[index], ...updates }
    const otherRanges = sizeRanges.filter(r => r.id !== id)

    const hasOverlap = otherRanges.some(existing =>
      updatedRange.minSize < existing.maxSize && updatedRange.maxSize > existing.minSize
    )
    if (hasOverlap) return false

    const newRanges = [...otherRanges, updatedRange].sort((a, b) => a.minSize - b.minSize)
    set({ sizeRanges: newRanges })
    safeStorage.set(SIZE_RANGES_STORAGE_KEY, newRanges)
    return true
  },
  deleteSizeRange: (id: string) => {
    const { sizeRanges } = get()
    if (sizeRanges.length <= 1) return false

    const newRanges = sizeRanges.filter(r => r.id !== id)
    set({ sizeRanges: newRanges })
    safeStorage.set(SIZE_RANGES_STORAGE_KEY, newRanges)
    return true
  },
  resetSizeRanges: () => {
    set({ sizeRanges: DEFAULT_SIZE_RANGES })
    safeStorage.set(SIZE_RANGES_STORAGE_KEY, DEFAULT_SIZE_RANGES)
  },

  selectedCategory: 'all',
  selectedSubExtensions: [],
  setSelectedCategory: (category: FileCategory | 'all') => {
    set({ selectedCategory: category, selectedSubExtensions: [] })
  },
  setSelectedSubExtensions: (extensions: string[]) => set({ selectedSubExtensions: extensions }),
  resetFilter: () => set({ selectedCategory: 'all', selectedSubExtensions: [] })

}))