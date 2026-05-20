export const IMAGE_CLASSIFICATION_RESULTS_KEY = 'image_classification_results'
export const IMAGE_DATA_STORAGE_PREFIX = 'image_data_'
export const THUMBNAIL_STORAGE_PREFIX = 'thumbnail_'

export const CLASSIFICATION_CACHE_CLEARED_EVENT = 'filedeal:classification-cache-cleared'

export type RendererCacheScope =
  | 'imagePreview'
  | 'classificationMemory'
  | 'classificationStorage'
  | 'thumbnailStorage'
  | 'imageDataStorage'

export type MainCacheScope = 'previewDisk' | 'chromiumDisk' | 'modelSessions'

export type CacheScope = RendererCacheScope | MainCacheScope

export const ALL_RENDERER_CACHE_SCOPES: RendererCacheScope[] = [
  'imagePreview',
  'classificationMemory',
  'classificationStorage',
  'thumbnailStorage',
  'imageDataStorage',
]

export const ALL_MAIN_CACHE_SCOPES: MainCacheScope[] = ['previewDisk', 'chromiumDisk', 'modelSessions']

export const ALL_CACHE_SCOPES: CacheScope[] = [...ALL_RENDERER_CACHE_SCOPES, ...ALL_MAIN_CACHE_SCOPES]

export interface CacheSizeStats {
  itemCount: number
  totalBytes: number
}

export interface ImagePreviewCacheStats extends CacheSizeStats {
  maxBytes: number
  hitRate: number
}

export interface RendererCacheOverview {
  imagePreview: ImagePreviewCacheStats
  classificationMemory: { itemCount: number }
  classificationStorage: CacheSizeStats
  thumbnailStorage: CacheSizeStats
  imageDataStorage: CacheSizeStats
}

export interface MainCacheOverview {
  previewDisk: CacheSizeStats
  chromiumDisk: CacheSizeStats
  modelSessions: { itemCount: number }
}

export interface FullCacheOverview {
  renderer: RendererCacheOverview
  main: MainCacheOverview | null
}
