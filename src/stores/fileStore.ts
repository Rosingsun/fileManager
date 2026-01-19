import { create } from 'zustand'
import type { FileInfo, OrganizeConfig, TreeNode, PreviewResultItem, HistoryItem } from '../types'

// 本地存储键名
const HISTORY_STORAGE_KEY = 'filedeal_history'

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
  // 添加历史记录：如果已存在相同路径，则更新其时间戳并移到顶部；否则添加新记录
  addHistory: (path: string) => {
    const { historyList } = get()
    const normalizedPath = path.replace(/\\/g, '/') // 统一路径分隔符
    const name = normalizedPath.split('/').pop() || normalizedPath
    const existingIndex = historyList.findIndex(item => item.path === normalizedPath)
    
    if (existingIndex >= 0) {
      // 如果已存在，移除旧记录并创建新的（更新时间戳）移到顶部
      const newList = [...historyList]
      newList.splice(existingIndex, 1)
      newList.unshift({
        id: normalizedPath,
        path: normalizedPath,
        name,
        timestamp: Date.now()
      })
      set({ historyList: newList })
      saveHistoryToStorage(newList)
    } else {
      // 如果不存在，添加新记录
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
  }
}))

