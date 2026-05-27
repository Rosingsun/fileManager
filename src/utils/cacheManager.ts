import { useFileStore } from '../stores'
import type {
  CacheScope,
  CacheSizeStats,
  FullCacheOverview,
  MainCacheOverview,
  MainCacheScope,
  RendererCacheOverview,
  RendererCacheScope,
} from '../types/cache'
import {
  ALL_MAIN_CACHE_SCOPES,
  ALL_RENDERER_CACHE_SCOPES,
  CLASSIFICATION_CACHE_CLEARED_EVENT,
  IMAGE_CLASSIFICATION_RESULTS_KEY,
  IMAGE_DATA_STORAGE_PREFIX,
  THUMBNAIL_STORAGE_PREFIX,
} from '../types/cache'
import {
  clearClassificationCache,
  getClassificationCacheStats,
} from './imageClassification'
import { imageLoader } from './imageLoader'

function localStorageEntryBytes(key: string, value: string): number {
  return new Blob([key]).size + new Blob([value]).size
}

function scanLocalStorageExactKey(key: string): CacheSizeStats {
  try {
    const value = localStorage.getItem(key)
    if (value === null) return { itemCount: 0, totalBytes: 0 }
    return { itemCount: 1, totalBytes: localStorageEntryBytes(key, value) }
  } catch {
    return { itemCount: 0, totalBytes: 0 }
  }
}

function scanLocalStorageByPrefix(prefix: string): CacheSizeStats {
  let itemCount = 0
  let totalBytes = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(prefix)) continue
      const value = localStorage.getItem(key)
      if (value === null) continue
      itemCount++
      totalBytes += localStorageEntryBytes(key, value)
    }
  } catch {
    /* ignore */
  }
  return { itemCount, totalBytes }
}

function removeLocalStorageByPrefix(prefix: string): number {
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix)) keys.push(key)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
  return keys.length
}

function dispatchClassificationCacheCleared(): void {
  window.dispatchEvent(new CustomEvent(CLASSIFICATION_CACHE_CLEARED_EVENT))
}

export function getRendererCacheOverview(): RendererCacheOverview {
  const stats = imageLoader.getCacheStats()
  return {
    imagePreview: {
      itemCount: stats.itemCount,
      totalBytes: stats.totalSize,
      maxBytes: stats.maxMemory,
      hitRate: imageLoader.getHitRate(),
    },
    classificationMemory: getClassificationCacheStats(),
    classificationStorage: scanLocalStorageExactKey(IMAGE_CLASSIFICATION_RESULTS_KEY),
    thumbnailStorage: scanLocalStorageByPrefix(THUMBNAIL_STORAGE_PREFIX),
    imageDataStorage: scanLocalStorageByPrefix(IMAGE_DATA_STORAGE_PREFIX),
  }
}

export async function getFullCacheOverview(): Promise<FullCacheOverview> {
  const renderer = getRendererCacheOverview()
  let main: MainCacheOverview | null = null
  if (window.electronAPI?.getCacheOverview) {
    main = await window.electronAPI.getCacheOverview()
  }
  return { renderer, main }
}

export function clearRendererCache(scopes: RendererCacheScope[]): void {
  let classificationTouched = false

  for (const scope of scopes) {
    switch (scope) {
      case 'imagePreview':
        imageLoader.clearCache()
        useFileStore.getState().bumpPreviewCacheEpoch()
        break
      case 'classificationMemory':
        clearClassificationCache()
        classificationTouched = true
        break
      case 'classificationStorage':
        try {
          localStorage.removeItem(IMAGE_CLASSIFICATION_RESULTS_KEY)
        } catch {
          /* ignore */
        }
        classificationTouched = true
        break
      case 'thumbnailStorage':
        removeLocalStorageByPrefix(THUMBNAIL_STORAGE_PREFIX)
        break
      case 'imageDataStorage':
        removeLocalStorageByPrefix(IMAGE_DATA_STORAGE_PREFIX)
        break
      default:
        break
    }
  }

  if (classificationTouched) {
    dispatchClassificationCacheCleared()
  }
}

export async function clearCacheScopes(scopes: CacheScope[]): Promise<void> {
  const rendererScopes = scopes.filter((s): s is RendererCacheScope =>
    (ALL_RENDERER_CACHE_SCOPES as readonly string[]).includes(s)
  )
  const mainScopes = scopes.filter((s): s is MainCacheScope =>
    (ALL_MAIN_CACHE_SCOPES as readonly string[]).includes(s)
  )

  if (rendererScopes.length > 0) {
    clearRendererCache(rendererScopes)
  }

  if (mainScopes.length > 0 && window.electronAPI?.clearAppCache) {
    await window.electronAPI.clearAppCache(mainScopes)
  }
}

export async function clearAllClearableCache(): Promise<void> {
  await clearCacheScopes([...ALL_RENDERER_CACHE_SCOPES, ...ALL_MAIN_CACHE_SCOPES])
}

export {
  IMAGE_CLASSIFICATION_RESULTS_KEY,
  IMAGE_DATA_STORAGE_PREFIX,
  THUMBNAIL_STORAGE_PREFIX,
  CLASSIFICATION_CACHE_CLEARED_EVENT,
  ALL_RENDERER_CACHE_SCOPES,
  ALL_MAIN_CACHE_SCOPES,
  ALL_CACHE_SCOPES,
} from '../types/cache'

export type {
  CacheScope,
  RendererCacheScope,
  MainCacheScope,
  RendererCacheOverview,
  MainCacheOverview,
  FullCacheOverview,
  CacheSizeStats,
  ImagePreviewCacheStats,
} from '../types/cache'
