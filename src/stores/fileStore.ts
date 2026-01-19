import { create } from 'zustand'
import type { FileInfo, OrganizeConfig, TreeNode, PreviewResultItem, HistoryItem, SizeRange } from '../types'

// 本地存储键名
const HISTORY_STORAGE_KEY = 'filedeal_history'
const SIZE_RANGES_STORAGE_KEY = 'filedeal_size_ranges'

// 默认大小范围
const DEFAULT_SIZE_RANGES: SizeRange[] = [
  { id: '1', name: '小文件', minSize: 0, maxSize: 10 * 1024 * 1024 }, // 0-10MB
  { id: '2', name: '中等文件', minSize: 10 * 1024 * 1024, maxSize: 100 * 1024 * 1024 }, // 10-100MB
  { id: '3', name: '大文件', minSize: 100 * 1024 * 1024, maxSize: Number.MAX_SAFE_INTEGER } // >100MB
]

// 从本地存储加载大小范围
const loadSizeRangesFromStorage = (): SizeRange[] => {
  try {
    const stored = localStorage.getItem(SIZE_RANGES_STORAGE_KEY)
    return stored ? JSON.parse(stored) : DEFAULT_SIZE_RANGES
  } catch (error) {
    console.error('Failed to load size ranges from storage:', error)
    return DEFAULT_SIZE_RANGES
  }
}

// 保存大小范围到本地存储
const saveSizeRangesToStorage = (ranges: SizeRange[]) => {
  try {
    localStorage.setItem(SIZE_RANGES_STORAGE_KEY, JSON.stringify(ranges))
  } catch (error) {
    console.error('Failed to save size ranges to storage:', error)
  }
}

// 从本地存储加载历史记录
const loadHistoryFromStorage = (): HistoryItem[] => {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to load history from storage:', error)
    return []
  }
}

// 保存历史记录到本地存储
const saveHistoryToStorage = (history: HistoryItem[]) => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
  } catch (error) {
    console.error('Failed to save history to storage:', error)
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
  
  historyList: loadHistoryFromStorage(),
  // 添加历史记录：如果已存在相同路径，则更新其时间戳但保持位置；否则添加新记录到顶部
  addHistory: (path: string) => {
    const { historyList } = get()
    const normalizedPath = path.replace(/\\/g, '/') // 统一路径分隔符
    const name = normalizedPath.split('/').pop() || normalizedPath
    const existingIndex = historyList.findIndex(item => item.path === normalizedPath)
    
    if (existingIndex >= 0) {
      // 如果已存在，更新时间戳但保持位置
      const newList = [...historyList]
      newList[existingIndex] = {
        ...newList[existingIndex],
        timestamp: Date.now()
      }
      set({ historyList: newList })
      saveHistoryToStorage(newList)
    } else {
      // 如果不存在，添加新记录到顶部
      const newHistoryItem: HistoryItem = {
        id: normalizedPath,
        path: normalizedPath,
        name,
        timestamp: Date.now()
      }
      set({ historyList: [newHistoryItem, ...historyList] })
      saveHistoryToStorage([newHistoryItem, ...historyList])
    }
  },
  removeHistory: (id: string) => {
    const { historyList } = get()
    const newList = historyList.filter(item => item.id !== id)
    set({ historyList: newList })
    saveHistoryToStorage(newList)
  },
  clearHistory: () => {
    set({ historyList: [] })
    saveHistoryToStorage([])
  },
  loadHistoryFromStorage: () => {
    const history = loadHistoryFromStorage()
    set({ historyList: history })
  },

  // 文件大小分类范围
  sizeRanges: loadSizeRangesFromStorage(),
  addSizeRange: (range: Omit<SizeRange, 'id'>) => {
    const { sizeRanges } = get()
    // 检查是否超过最大档次限制（最多5档）
    if (sizeRanges.length >= 5) {
      return false // 已达到最大档次，不允许添加
    }
    // 检查范围是否重叠
    const hasOverlap = sizeRanges.some(existing => 
      (range.minSize < existing.maxSize && range.maxSize > existing.minSize)
    )
    if (hasOverlap) {
      return false // 重叠，不允许添加
    }
    const newRange: SizeRange = {
      ...range,
      id: Date.now().toString()
    }
    const newRanges = [...sizeRanges, newRange].sort((a, b) => a.minSize - b.minSize)
    set({ sizeRanges: newRanges })
    saveSizeRangesToStorage(newRanges)
    return true
  },
  updateSizeRange: (id: string, updates: Partial<SizeRange>) => {
    const { sizeRanges } = get()
    const index = sizeRanges.findIndex(r => r.id === id)
    if (index === -1) return false

    const updatedRange = { ...sizeRanges[index], ...updates }
    const otherRanges = sizeRanges.filter(r => r.id !== id)
    
    // 检查更新后的范围是否与其他范围重叠
    const hasOverlap = otherRanges.some(existing => 
      (updatedRange.minSize < existing.maxSize && updatedRange.maxSize > existing.minSize)
    )
    if (hasOverlap) {
      return false // 重叠，不允许更新
    }

    const newRanges = [...otherRanges, updatedRange].sort((a, b) => a.minSize - b.minSize)
    set({ sizeRanges: newRanges })
    saveSizeRangesToStorage(newRanges)
    return true
  },
  deleteSizeRange: (id: string) => {
    const { sizeRanges } = get()
    // 检查是否只剩1档，如果是则不允许删除
    if (sizeRanges.length <= 1) {
      return false // 最少保留1档
    }
    const newRanges = sizeRanges.filter(r => r.id !== id)
    set({ sizeRanges: newRanges })
    saveSizeRangesToStorage(newRanges)
    return true
  },
  resetSizeRanges: () => {
    set({ sizeRanges: DEFAULT_SIZE_RANGES })
    saveSizeRangesToStorage(DEFAULT_SIZE_RANGES)
  }

}))