/**
 * 图片分类工具函数
 */

import type {
  ImageContentCategory,
  ImageClassificationResult,
  ImageClassificationConfig,
  ImageClassificationBatchResult,
  ClassificationPresetId
} from '../types'
import {
  IMAGE_CATEGORY_LABELS,
  IMAGE_CATEGORY_COLORS,
  CLASSIFICATION_PRESET_STORAGE_KEY,
  DEFAULT_CLASSIFICATION_PRESET_ID,
  normalizeClassificationPresetId,
  getClassificationDisplayLabel
} from '../types'

export { getClassificationDisplayLabel }

export const categoryLabels = IMAGE_CATEGORY_LABELS
export const categoryColors = IMAGE_CATEGORY_COLORS

const classificationCache = new Map<string, ImageClassificationResult>()

export function getCachedClassification(filePath: string): ImageClassificationResult | null {
  return classificationCache.get(filePath) || null
}

export function cacheClassification(result: ImageClassificationResult): void {
  classificationCache.set(result.filePath, result)
}

export function cacheClassifications(results: ImageClassificationResult[]): void {
  results.forEach(result => {
    classificationCache.set(result.filePath, result)
  })
}

export function clearClassificationCache(): void {
  classificationCache.clear()
}

export function getClassificationCacheStats(): { itemCount: number } {
  return { itemCount: classificationCache.size }
}

export function getCategoryLabel(category: ImageContentCategory): string {
  return categoryLabels[category] || categoryLabels.other
}

export function getCategoryColor(category: ImageContentCategory): string {
  return categoryColors[category] || categoryColors.other
}

export function getStoredClassificationPreset(): ClassificationPresetId {
  try {
    const saved = localStorage.getItem(CLASSIFICATION_PRESET_STORAGE_KEY)
    return normalizeClassificationPresetId(saved)
  } catch {
    /* ignore */
  }
  return DEFAULT_CLASSIFICATION_PRESET_ID
}

export async function classifyImages(
  imagePaths: string[],
  options?: {
    batchSize?: number
    presetId?: ClassificationPresetId
    onProgress?: (
      current: number,
      total: number,
      currentFile?: string,
      latestResult?: ImageClassificationResult
    ) => void
    useCache?: boolean
  }
): Promise<ImageClassificationResult[]> {
  const { batchSize = 10, presetId = getStoredClassificationPreset(), onProgress, useCache = true } = options || {}
  const results: ImageClassificationResult[] = []
  const uncachedPaths: string[] = []

  if (useCache) {
    for (const path of imagePaths) {
      const cached = getCachedClassification(path)
      if (cached) {
        results.push(cached)
      } else {
        uncachedPaths.push(path)
      }
    }
  } else {
    uncachedPaths.push(...imagePaths)
  }

  if (uncachedPaths.length === 0) {
    return results
  }

  if (!window.electronAPI) {
    throw new Error('electronAPI 不可用')
  }

  const config: ImageClassificationConfig = {
    imagePaths: uncachedPaths,
    batchSize,
    includeSubdirectories: false,
    presetId
  }

  let progressUnsubscribe: (() => void) | null = null
  if (onProgress || useCache) {
    progressUnsubscribe = window.electronAPI.onImageClassificationProgress((progress) => {
      if (progress.latestResult && useCache) {
        cacheClassification(progress.latestResult)
      }
      if (onProgress && progress.status === 'classifying' && progress.current && progress.total) {
        onProgress(
          progress.current,
          progress.total,
          progress.currentFile,
          progress.latestResult
        )
      }
    })
  }

  try {
    const batchResult: ImageClassificationBatchResult = await window.electronAPI.classifyImagesBatch(config)

    if (useCache) {
      cacheClassifications(batchResult.results)
    }

    const resultMap = new Map(batchResult.results.map(r => [r.filePath, r]))
    const allResults: ImageClassificationResult[] = []

    for (const path of imagePaths) {
      const cached = getCachedClassification(path)
      if (cached) {
        allResults.push(cached)
      } else {
        const result = resultMap.get(path)
        if (result) {
          allResults.push(result)
        }
      }
    }

    return allResults
  } finally {
    if (progressUnsubscribe) {
      progressUnsubscribe()
    }
  }
}

export async function classifyImage(
  imagePath: string,
  useCache: boolean = true,
  presetId?: ClassificationPresetId
): Promise<ImageClassificationResult> {
  if (useCache) {
    const cached = getCachedClassification(imagePath)
    if (cached) {
      return cached
    }
  }

  if (!window.electronAPI) {
    throw new Error('electronAPI 不可用')
  }

  const result = await window.electronAPI.classifyImage(
    imagePath,
    presetId ?? getStoredClassificationPreset()
  )

  if (useCache) {
    cacheClassification(result)
  }

  return result
}

export function filterByCategory(
  results: ImageClassificationResult[],
  category: ImageContentCategory | 'all'
): ImageClassificationResult[] {
  if (category === 'all') {
    return results
  }
  return results.filter(r => r.category === category)
}
