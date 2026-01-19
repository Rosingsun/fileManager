import { create } from 'zustand'
import type { FileInfo, OrganizeConfig, TreeNode, PreviewResultItem } from '../types'

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
}

export const useFileStore = create<FileStore>((set) => ({
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
  setPreviewResults: (results: PreviewResultItem[]) => set({ previewResults: results })
}))

