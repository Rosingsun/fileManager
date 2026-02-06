// Electron API 类型定义
declare global {
  interface Window {
    electronAPI?: {
      openDirectory: () => Promise<string | null>
      readDirectory: (path: string) => Promise<import('./index').FileInfo[]>
      readDirectoryRecursive: (path: string) => Promise<import('./index').FileInfo[]>
      organizeFiles: (config: import('./index').OrganizeConfig) => Promise<Array<{ from: string; to: string; success: boolean; error?: string }>>
      extractFiles: (targetPath: string, extensions: string[], conflictAction: 'skip' | 'overwrite' | 'rename') => Promise<Array<{ from: string; to: string; success: boolean; error?: string }>>
      getAppVersion: () => Promise<string>
      getPlatform: () => Promise<string>
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      previewFile: (filePath: string, fileList?: FileInfo[], currentIndex?: number) => void
      openFile: (filePath: string) => Promise<boolean>
      renameFile: (oldPath: string, newName: string) => Promise<boolean>
      deleteFile: (filePath: string) => Promise<boolean>
      moveFile: (oldPath: string, newPath: string) => Promise<boolean>
      getImageBase64: (filePath: string) => Promise<string>
      getImageDimensions: (filePath: string) => Promise<{ width: number; height: number } | null>
      getImageThumbnail: (filePath: string, size?: number, quality?: number) => Promise<string>
      scanSimilarImages: (config: import('./index').SimilarityScanConfig) => Promise<import('./index').SimilarityScanResult>
      onSimilarityScanProgress: (callback: (progress: import('./index').SimilarityScanProgress) => void) => () => void
      cancelSimilarityScan: () => void
      classifyImage: (imagePath: string) => Promise<import('./index').ImageClassificationResult>
      classifyImagesBatch: (config: import('./index').ImageClassificationConfig) => Promise<import('./index').ImageClassificationBatchResult>
      onImageClassificationProgress: (callback: (progress: import('./index').ImageClassificationProgress) => void) => () => void
      cancelImageClassification: () => void
      checkModelExists: (modelId?: string) => Promise<boolean>
      getAvailableModels: () => Promise<Array<{ id: string; name: string; description: string; sizeMB: number }>>
      downloadModel: (modelId?: string, onProgress?: (progress: number) => void, signal?: AbortSignal) => Promise<{ success: boolean; error?: string; cancelled?: boolean; downloadUrls?: string[] }>
      openExternalLink: (url: string) => Promise<boolean>
      selectAndSaveModelFile: () => Promise<string | null>
      saveModelFile: (sourcePath: string) => Promise<string | null>
    }
  }
}

export {}

