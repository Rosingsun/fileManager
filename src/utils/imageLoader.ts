/**
 * 优化的图片加载器
 * 集成缓存管理、错误恢复和性能优化
 */

import { imageCache } from './imageCache'

export interface LoadOptions {
  useCache?: boolean
  timeout?: number
  retryCount?: number
  fallbackSize?: number
  fallbackQuality?: number
}

export interface ImageLoadResult {
  data: string
  isThumbnail: boolean
  fromCache: boolean
  size: number
}

export class OptimizedImageLoader {
  private static instance: OptimizedImageLoader
  private loadingPromises = new Map<string, Promise<string>>()

  private constructor() {}

  public static getInstance(): OptimizedImageLoader {
    if (!OptimizedImageLoader.instance) {
      OptimizedImageLoader.instance = new OptimizedImageLoader()
    }
    return OptimizedImageLoader.instance
  }

  /**
   * 加载图片缩略图
   */
  async loadThumbnail(
    filePath: string, 
    size: number = 120, 
    quality: number = 60,
    options: LoadOptions = {}
  ): Promise<ImageLoadResult> {
    const cacheKey = `thumb:${filePath}:${size}:${quality}`
    
    // 检查缓存
    if (options.useCache !== false) {
      const cached = imageCache.get(cacheKey)
      if (cached) {
        return {
          data: cached,
          isThumbnail: true,
          fromCache: true,
          size: new Blob([cached]).size
        }
      }
    }

    // 检查是否正在加载
    const existingPromise = this.loadingPromises.get(cacheKey)
    if (existingPromise) {
      const data = await existingPromise
      return {
        data,
        isThumbnail: true,
        fromCache: false,
        size: new Blob([data]).size
      }
    }

    // 开始加载
    const loadPromise = this.loadWithRetry(
      () => this.loadThumbnailInternal(filePath, size, quality),
      options.retryCount || 2,
      options.timeout || 15000
    )

    this.loadingPromises.set(cacheKey, loadPromise)

    try {
      const data = await loadPromise
      
      if (data && data.trim() !== '') {
        // 缓存成功结果
        imageCache.set(cacheKey, data)
        
        return {
          data,
          isThumbnail: true,
          fromCache: false,
          size: new Blob([data]).size
        }
      } else {
        // 缓存失败结果
        imageCache.set(cacheKey, '', true)
        throw new Error('缩略图加载失败')
      }
    } finally {
      this.loadingPromises.delete(cacheKey)
    }
  }

  /**
   * 加载原图
   */
  async loadOriginal(
    filePath: string,
    options: LoadOptions = {}
  ): Promise<ImageLoadResult> {
    const cacheKey = `original:${filePath}`
    
    // 检查缓存
    if (options.useCache !== false) {
      const cached = imageCache.get(cacheKey)
      if (cached) {
        return {
          data: cached,
          isThumbnail: false,
          fromCache: true,
          size: new Blob([cached]).size
        }
      }
    }

    // 检查是否正在加载
    const existingPromise = this.loadingPromises.get(cacheKey)
    if (existingPromise) {
      const data = await existingPromise
      return {
        data,
        isThumbnail: false,
        fromCache: false,
        size: new Blob([data]).size
      }
    }

    // 开始加载
    const loadPromise = this.loadWithRetry(
      () => this.loadOriginalInternal(filePath),
      options.retryCount || 1,
      options.timeout || 20000
    )

    this.loadingPromises.set(cacheKey, loadPromise)

    try {
      const data = await loadPromise
      
      if (data && data.trim() !== '') {
        // 缓存成功结果
        imageCache.set(cacheKey, data)
        
        return {
          data,
          isThumbnail: false,
          fromCache: false,
          size: new Blob([data]).size
        }
      } else {
        // 缓存失败结果
        imageCache.set(cacheKey, '', true)
        throw new Error('原图加载失败')
      }
    } finally {
      this.loadingPromises.delete(cacheKey)
    }
  }

  /**
   * 智能加载：优先原图，失败时自动降级到缩略图
   */
  async loadSmart(
    filePath: string,
    maxSize: number = 50 * 1024 * 1024, // 50MB
    fileSize?: number,
    options: LoadOptions = {}
  ): Promise<ImageLoadResult> {
    // 如果文件太大，直接使用缩略图
    if (fileSize && fileSize > maxSize) {
      console.log(`[ImageLoader] 大文件使用缩略图: ${filePath} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`)
      return this.loadThumbnail(
        filePath, 
        options.fallbackSize || 200, 
        options.fallbackQuality || 70,
        options
      )
    }

    try {
      // 尝试加载原图
      return await this.loadOriginal(filePath, options)
    } catch (error) {
      console.warn(`[ImageLoader] 原图加载失败，降级到缩略图: ${filePath}`, error)
      
      // 降级到缩略图
      return this.loadThumbnail(
        filePath, 
        options.fallbackSize || 200, 
        options.fallbackQuality || 70,
        options
      )
    }
  }

  /**
   * 批量预加载
   */
  async preloadBatch(
    filePaths: string[],
    priority: 'thumbnail' | 'original' = 'thumbnail',
    concurrency: number = 3
  ): Promise<void> {
    const batches: string[][] = []
    
    for (let i = 0; i < filePaths.length; i += concurrency) {
      batches.push(filePaths.slice(i, i + concurrency))
    }

    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(async (filePath) => {
          const cacheKey = priority === 'thumbnail' 
            ? `thumb:${filePath}:120:60`
            : `original:${filePath}`
          
          if (!imageCache.has(cacheKey)) {
            try {
              if (priority === 'thumbnail') {
                await this.loadThumbnail(filePath)
              } else {
                await this.loadOriginal(filePath)
              }
            } catch (error) {
              console.warn(`预加载失败: ${filePath}`, error)
            }
          }
        })
      )
    }
  }

  /**
   * 带重试的加载
   */
  private async loadWithRetry(
    loadFn: () => Promise<string>,
    retryCount: number,
    timeout: number
  ): Promise<string> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const result = await Promise.race([
          loadFn(),
          new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error('加载超时')), timeout)
          )
        ])
        
        if (result && result.trim() !== '') {
          return result
        }
      } catch (error) {
        lastError = error as Error
        
        if (attempt < retryCount) {
          // 指数退避
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('加载失败')
  }

  /**
   * 内部缩略图加载
   */
  private async loadThumbnailInternal(
    filePath: string,
    size: number,
    quality: number
  ): Promise<string> {
    if (!window.electronAPI?.getImageThumbnail) {
      throw new Error('Electron API 不可用')
    }

    return await window.electronAPI.getImageThumbnail(filePath, size, quality)
  }

  /**
   * 内部原图加载
   */
  private async loadOriginalInternal(filePath: string): Promise<string> {
    if (!window.electronAPI?.getImageBase64) {
      throw new Error('Electron API 不可用')
    }

    return await window.electronAPI.getImageBase64(filePath)
  }

  /**
   * 清理指定路径的缓存
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      // 清理特定文件的所有缓存
      const keysToDelete: string[] = []
      
      for (const key of imageCache['cache'].keys()) {
        if (key.includes(filePath)) {
          keysToDelete.push(key)
        }
      }
      
      keysToDelete.forEach(key => imageCache.delete(key))
    } else {
      // 清理所有缓存
      imageCache.clear()
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return imageCache.getStats()
  }

  /**
   * 获取缓存命中率
   */
  getHitRate(): number {
    return imageCache.getHitRate()
  }
}

// 导出单例实例
export const imageLoader = OptimizedImageLoader.getInstance()