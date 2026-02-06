/**
 * 图片分类工具函数
 * 提供分类结果缓存、批量分类封装和标签显示等功能
 */

import type { ImageContentCategory, ImageClassificationResult, ImageClassificationConfig, ImageClassificationBatchResult } from '../types'

// 分类标签显示名称映射
export const categoryLabels: Record<ImageContentCategory, string> = {
  person: '人物', portrait: '人像', selfie: '自拍',
  dog: '狗', cat: '猫', bird: '鸟类', wild_animal: '野生动物', marine_animal: '海洋生物', insect: '昆虫', pet: '宠物',
  landscape: '风景', mountain: '山脉', beach: '海滩', sunset: '日落', forest: '森林', cityscape: '城市风光', night_scene: '夜景',
  building: '建筑', landmark: '地标', interior: '室内', street: '街道',
  food: '食物', drink: '饮品', dessert: '甜点',
  vehicle: '车辆', aircraft: '飞机', ship: '船舶',
  art: '艺术', technology: '科技', document: '文档', other: '其他'
}

// 分类标签颜色映射
export const categoryColors: Record<ImageContentCategory, string> = {
  person: 'purple', portrait: 'magenta', selfie: 'volcano',
  dog: 'orange', cat: 'gold', bird: 'cyan', wild_animal: 'green', marine_animal: 'blue', insect: 'lime', pet: 'gold',
  landscape: 'green', mountain: 'teal', beach: 'blue', sunset: 'orange', forest: 'forestgreen', cityscape: 'geekblue', night_scene: 'purple',
  building: 'blue', landmark: 'cyan', interior: 'lime', street: 'geekblue',
  food: 'red', drink: 'cyan', dessert: 'pink',
  vehicle: 'blue', aircraft: 'purple', ship: 'cyan',
  art: 'magenta', technology: 'geekblue', document: 'gold', other: 'default'
}

// 分类结果缓存（使用内存缓存，页面刷新后失效）
const classificationCache = new Map<string, ImageClassificationResult>()

/**
 * 获取分类结果（优先从缓存读取）
 */
export function getCachedClassification(filePath: string): ImageClassificationResult | null {
  return classificationCache.get(filePath) || null
}

/**
 * 缓存分类结果
 */
export function cacheClassification(result: ImageClassificationResult): void {
  classificationCache.set(result.filePath, result)
}

/**
 * 批量缓存分类结果
 */
export function cacheClassifications(results: ImageClassificationResult[]): void {
  results.forEach(result => {
    classificationCache.set(result.filePath, result)
  })
}

/**
 * 清除分类缓存
 */
export function clearClassificationCache(): void {
  classificationCache.clear()
}

/**
 * 获取分类标签显示名称
 */
export function getCategoryLabel(category: ImageContentCategory): string {
  return categoryLabels[category] || categoryLabels.other
}

/**
 * 获取分类标签颜色
 */
export function getCategoryColor(category: ImageContentCategory): string {
  return categoryColors[category] || categoryColors.other
}

/**
 * 批量分类图片（封装函数，包含缓存和进度处理）
 */
export async function classifyImages(
  imagePaths: string[],
  options?: {
    batchSize?: number
    onProgress?: (current: number, total: number, currentFile?: string) => void
    useCache?: boolean
  }
): Promise<ImageClassificationResult[]> {
  const { batchSize = 10, onProgress, useCache = true } = options || {}
  const results: ImageClassificationResult[] = []
  const uncachedPaths: string[] = []

  // 先从缓存读取
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

  // 如果没有需要分类的图片，直接返回缓存结果
  if (uncachedPaths.length === 0) {
    return results
  }

  // 批量分类未缓存的图片
  if (!window.electronAPI) {
    throw new Error('electronAPI 不可用')
  }

  const config: ImageClassificationConfig = {
    imagePaths: uncachedPaths,
    batchSize,
    includeSubdirectories: false
  }

  // 监听进度
  let progressUnsubscribe: (() => void) | null = null
  if (onProgress) {
    progressUnsubscribe = window.electronAPI.onImageClassificationProgress((progress) => {
      if (progress.status === 'classifying' && progress.current && progress.total) {
        const totalProcessed = results.length + (progress.current || 0)
        onProgress(totalProcessed, imagePaths.length, progress.currentFile)
      }
    })
  }

  try {
    const batchResult: ImageClassificationBatchResult = await window.electronAPI.classifyImagesBatch(config)
    
    // 缓存结果
    if (useCache) {
      cacheClassifications(batchResult.results)
    }
    
    // 合并结果（保持原始顺序）
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

/**
 * 分类单张图片（带缓存）
 */
export async function classifyImage(
  imagePath: string,
  useCache: boolean = true
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

  const result = await window.electronAPI.classifyImage(imagePath)
  
  if (useCache) {
    cacheClassification(result)
  }
  
  return result
}

/**
 * 根据分类筛选文件路径
 */
export function filterByCategory(
  results: ImageClassificationResult[],
  category: ImageContentCategory | 'all'
): ImageClassificationResult[] {
  if (category === 'all') {
    return results
  }
  return results.filter(r => r.category === category)
}
