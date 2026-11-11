// Electron API 类型定义
declare global {
  interface Window {
    electronAPI?: {
      openDirectory: () => Promise<string | null>
      readDirectory: (path: string) => Promise<import('./index').FileInfo[]>
      readDirectoryPage: (
        path: string,
        options: import('./index').DirectoryPageRequest
      ) => Promise<import('./index').DirectoryPageResult>
      readDirectoryRecursive: (path: string) => Promise<import('./index').FileInfo[]>
      organizeFiles: (config: import('./index').OrganizeConfig) => Promise<Array<{ from: string; to: string; success: boolean; error?: string }>>
      extractFiles: (
        targetPath: string,
        filters: {
          extensions: string[];
          minSize?: number;
          maxSize?: number;
          category?: import('./index').FileCategory | 'all';
        },
        conflictAction: 'skip' | 'overwrite' | 'rename'
      ) => Promise<Array<{ from: string; to: string; success: boolean; error?: string }>>
      getAppVersion: () => Promise<string>
      getPlatform: () => Promise<string>
      getCacheOverview: () => Promise<import('./cache').MainCacheOverview>
      clearAppCache: (scopes: import('./cache').MainCacheScope[]) => Promise<void>
      minimizeWindow: () => void
      maximizeWindow: () => void
      closeWindow: () => void
      previewFile: (filePath: string, fileList?: FileInfo[], currentIndex?: number) => void
      openFile: (filePath: string) => Promise<boolean>
      renameFile: (oldPath: string, newName: string) => Promise<boolean>
      deleteFile: (filePath: string) => Promise<boolean>
      moveFile: (oldPath: string, newPath: string) => Promise<boolean>
      batchCopyToDirectory: (
        sources: string[],
        destDir: string,
        conflictAction: import('./index').FileConflictAction
      ) => Promise<import('./index').BatchFileOpResult[]>
      batchRelocate: (
        moves: import('./index').BatchRelocateEntry[],
        conflictAction: import('./index').FileConflictAction
      ) => Promise<import('./index').BatchFileOpResult[]>
      getImageBase64: (filePath: string, maxEdge?: number) => Promise<string>
      probeMediaAsset: (filePath: string) => Promise<import('./index').MediaAssetInfo>
      getFileStats: (
        filePath: string
      ) => Promise<{ size: number; createdTime: number; modifiedTime: number } | null>
      getImageDimensions: (filePath: string) => Promise<{ width: number; height: number } | null>
      getImageThumbnail: (filePath: string, size?: number, quality?: number) => Promise<string>
      getShutterCount: (filePath: string) => Promise<{ count: number | null; message?: string }>
      getPhotoFocusPoints: (filePath: string) => Promise<import('./index').PhotoFocusPointsResult>
      // image editing operations
      applyEdits: (paths: string[] | string, settings: import('./index').ImageEditSettings) => Promise<import('./index').BatchOperationResult[]>
      previewEdits: (filePath: string, settings: import('./index').ImageEditSettings) => Promise<string>
      previewExport: (
        filePath: string,
        options: import('./index').FormatConversionOptions
      ) => Promise<import('./index').ExportPreviewResult>
      getImageHistogram: (filePath: string) => Promise<{
        bins: number[]
        total: number
        peak: number
        clipShadow: number
        clipHighlight: number
        rgbBins?: { r: number[]; g: number[]; b: number[] }
      }>
      analyzeForEdit: (filePath: string) => Promise<import('./index').ImageEditSettings>
      convertFormat: (
        paths: string[] | string,
        options: import('./index').FormatConversionOptions,
        outputPath?: string
      ) => Promise<import('./index').BatchOperationResult[]>
      compressImage: (paths: string[] | string, options: import('./index').CompressionOptions) => Promise<import('./index').BatchOperationResult[]>
      estimateCompressedSize: (path: string, options: import('./index').CompressionOptions) => Promise<number>
      scanSimilarImages: (config: import('./index').SimilarityScanConfig) => Promise<import('./index').SimilarityScanResult>
      onSimilarityScanProgress: (callback: (progress: import('./index').SimilarityScanProgress) => void) => () => void
      cancelSimilarityScan: () => void
      scanImageQuality: (config: import('./index').ImageQualityScanConfig) => Promise<import('./index').ImageQualityScanResult>
      onImageQualityScanProgress: (callback: (progress: import('./index').ImageQualityScanProgress) => void) => () => void
      cancelImageQualityScan: () => void
      classifyImage: (imagePath: string, presetOrModelId?: string) => Promise<import('./index').ImageClassificationResult>
      classifyImagesBatch: (config: import('./index').ImageClassificationConfig) => Promise<import('./index').ImageClassificationBatchResult>
      onImageClassificationProgress: (callback: (progress: import('./index').ImageClassificationProgress) => void) => () => void
      cancelImageClassification: () => void
      checkModelExists: (modelOrPresetId?: string) => Promise<boolean>
      getAvailableModels: () => Promise<Array<{ id: string; name: string; description: string; sizeMB: number }>>
      getAvailablePresets: () => Promise<import('./index').ClassificationPresetInfo[]>
      downloadModel: (modelOrPresetId?: string, onProgress?: (progress: number) => void, signal?: AbortSignal) => Promise<{ success: boolean; error?: string; cancelled?: boolean; downloadUrls?: string[] }>
      openExternalLink: (url: string) => Promise<boolean>
      saveRefreshToken: (token: string) => Promise<{ ok: boolean; error?: string }>
      loadRefreshToken: () => Promise<string | null>
      clearRefreshToken: () => Promise<void>
      setCurrentUserId: (userId: string | null) => Promise<void>
      appendOperationLog: (payload: {
        userId: string
        action: string
        summary?: string
        detail?: string
      }) => Promise<void>
      listOperationLogs: (
        userId: string,
        limit?: number
      ) => Promise<Array<{ id: string; ts: number; action: string; summary?: string; detail?: string }>>
      clearOperationLogs: (userId: string) => Promise<void>
      selectAndSaveModelFile: () => Promise<string | null>
      saveModelFile: (sourcePath: string) => Promise<string | null>
      
      // 实用工具
      batchRename: (files: string[], options: import('./index').BatchRenameOptions) => Promise<import('./index').RenameResult[]>
      addWatermark: (files: string[], options: import('./index').WatermarkOptions) => Promise<import('./index').BatchOperationResult[]>
      previewWatermark: (filePath: string, options: import('./index').WatermarkOptions) => Promise<string>
      stitchImages: (images: string[], options: import('./index').StitchOptions) => Promise<string>
      createGif: (frames: import('./index').GifFrame[], options: import('./index').GifOptions) => Promise<string>
      imagesToPdf: (images: string[], options: import('./index').PdfOptions) => Promise<string>
      generateThumbnails: (files: string[], options: import('./index').ThumbnailOptions) => Promise<import('./index').ThumbnailResult[]>
      enhanceImage: (file: string, options: import('./index').EnhanceOptions) => Promise<string>
      previewFocusAdjust: (
        filePath: string,
        options: import('./index').FocusAdjustOptions
      ) => Promise<string>
      applyFocusAdjust: (
        filePath: string,
        options: import('./index').FocusAdjustOptions
      ) => Promise<string>
      selectFiles: (filter?: string) => Promise<string[] | null>

      // 云盘（多 Provider 架构：当前已实现阿里云盘）
      cloud: {
        listProviders: () => Promise<import('./cloud').CloudProviderInfo[]>
        isVaultAvailable: () => Promise<boolean>
        hasCredentials: (providerId: import('./cloud').CloudProviderId) => Promise<boolean>
        setCredentials: (
          providerId: import('./cloud').CloudProviderId,
          raw: string
        ) => Promise<{
          ok: boolean
          accountHint?: string
          maskedToken?: string
          code?: string
          message?: string
          retryable?: boolean
        }>
        clearCredentials: (providerId: import('./cloud').CloudProviderId) => Promise<{ ok: boolean }>
        validateCredentials: (providerId: import('./cloud').CloudProviderId) => Promise<import('./cloud').CloudValidateResult>
        list: (
          providerId: import('./cloud').CloudProviderId,
          parentId: string,
          cursor?: string
        ) => Promise<import('./cloud').CloudResponse<import('./cloud').CloudListResult>>
        mkdir: (
          providerId: import('./cloud').CloudProviderId,
          parentId: string,
          name: string
        ) => Promise<import('./cloud').CloudResponse<import('./cloud').CloudMkdirResult>>
        remove: (
          providerId: import('./cloud').CloudProviderId,
          fileId: string
        ) => Promise<import('./cloud').CloudResponse<null>>
        rename: (
          providerId: import('./cloud').CloudProviderId,
          fileId: string,
          newName: string
        ) => Promise<import('./cloud').CloudResponse<null>>
        move: (
          providerId: import('./cloud').CloudProviderId,
          fileId: string,
          newParentId: string,
          newName?: string
        ) => Promise<import('./cloud').CloudResponse<null>>
        getDownloadTicket: (
          providerId: import('./cloud').CloudProviderId,
          fileId: string
        ) => Promise<import('./cloud').CloudResponse<import('./cloud').CloudDownloadTicket>>
        upload: (
          providerId: import('./cloud').CloudProviderId,
          localPath: string,
          options: import('./cloud').CloudUploadOptions,
          sessionId: string
        ) => Promise<import('./cloud').CloudResponse<{ fileId: string; name: string; size: number }>>
        cancelUpload: (sessionId: string) => Promise<{ ok: boolean; cancelled: boolean }>
        onUploadProgress: (
          callback: (progress: import('./cloud').CloudUploadProgress) => void
        ) => () => void
        openExternal: (url: string) => Promise<{ ok: boolean }>
      }
    }
  }
}

export {}

