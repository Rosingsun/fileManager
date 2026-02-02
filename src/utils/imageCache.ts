/**
 * 图片缓存管理器
 * 提供智能缓存、内存管理和错误恢复功能
 */

interface CacheEntry {
  data: string
  timestamp: number
  size: number
  accessCount: number
  lastAccessed: number
  isFailure?: boolean
}

interface CacheStats {
  totalSize: number
  maxMemory: number
  itemCount: number
  hitCount: number
  missCount: number
}

export class ImageCacheManager {
  private cache = new Map<string, CacheEntry>()
  private maxMemory: number
  private maxAge: number
  private stats: CacheStats = {
    totalSize: 0,
    maxMemory: 0,
    itemCount: 0,
    hitCount: 0,
    missCount: 0
  }

  constructor(maxMemory: number = 100 * 1024 * 1024, maxAge: number = 10 * 60 * 1000) {
    this.maxMemory = maxMemory // 默认100MB
    this.maxAge = maxAge // 默认10分钟
    this.stats.maxMemory = maxMemory
    
    // 定期清理过期缓存
    setInterval(() => this.cleanup(), 5 * 60 * 1000) // 每5分钟清理一次
  }

  /**
   * 获取缓存项
   */
  get(key: string): string | null {
    const entry = this.cache.get(key)
    if (!entry) {
      this.stats.missCount++
      return null
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key)
      this.updateStats()
      this.stats.missCount++
      return null
    }

    // 检查是否是失败项
    if (entry.isFailure) {
      this.stats.missCount++
      return null
    }

    // 更新访问统计
    entry.accessCount++
    entry.lastAccessed = Date.now()
    this.stats.hitCount++
    
    return entry.data
  }

  /**
   * 设置缓存项
   */
  set(key: string, data: string, isFailure: boolean = false): void {
    if (!data || data.trim() === '') {
      // 空数据也记录为失败，避免重复尝试
      this.cache.set(key, {
        data: '',
        timestamp: Date.now(),
        size: 0,
        accessCount: 0,
        lastAccessed: Date.now(),
        isFailure: true
      })
      return
    }

    const size = new Blob([data]).size

    // 检查内存限制，如果需要则清理
    this.ensureSpace(size)

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      size,
      accessCount: 1,
      lastAccessed: Date.now(),
      isFailure
    }

    this.cache.set(key, entry)
    this.updateStats()
  }

  /**
   * 检查缓存中是否存在（包括失败项）
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key)
      this.updateStats()
      return false
    }

    return true
  }

  /**
   * 删除缓存项
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.updateStats()
    }
    return deleted
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
    this.updateStats()
  }

  /**
   * 清理过期和最少使用的缓存项
   */
  private cleanup(): void {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())

    // 删除过期项
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key)
      }
    }

    // 如果仍然超出内存限制，删除最少使用的项
    this.ensureSpace(0)

    this.updateStats()
  }

  /**
   * 确保有足够的内存空间
   */
  private ensureSpace(requiredSize: number): void {
    if (this.stats.totalSize + requiredSize <= this.maxMemory) {
      return
    }

    // 按最少使用顺序排序
    const entries = Array.from(this.cache.entries()).sort((a, b) => {
      const scoreA = this.calculateScore(a[1])
      const scoreB = this.calculateScore(b[1])
      return scoreA - scoreB
    })

    // 删除项直到有足够空间
    let freedSpace = 0
    for (const [key, entry] of entries) {
      this.cache.delete(key)
      freedSpace += entry.size
      
      if (this.stats.totalSize - freedSpace + requiredSize <= this.maxMemory) {
        break
      }
    }
  }

  /**
   * 计算缓存项的分数（用于LRU淘汰）
   */
  private calculateScore(entry: CacheEntry): number {
    const age = Date.now() - entry.lastAccessed
    const frequency = entry.accessCount
    return age / frequency // 越久未访问且访问频率越低，分数越高
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    let totalSize = 0
    let itemCount = 0

    for (const entry of this.cache.values()) {
      totalSize += entry.size
      itemCount++
    }

    this.stats.totalSize = totalSize
    this.stats.itemCount = itemCount
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * 预热缓存（批量加载指定图片）
   */
  async preload(imagePaths: string[], loadFn: (path: string) => Promise<string>): Promise<void> {
    const batchSize = 3 // 并发加载数量
    const batches: string[][] = []

    for (let i = 0; i < imagePaths.length; i += batchSize) {
      batches.push(imagePaths.slice(i, i + batchSize))
    }

    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(async (path) => {
          if (!this.has(path)) {
            try {
              const data = await loadFn(path)
              this.set(path, data)
            } catch (error) {
              console.warn(`预热缓存失败: ${path}`, error)
              this.set(path, '', true) // 标记为失败
            }
          }
        })
      )
    }
  }

  /**
   * 获取缓存命中率
   */
  getHitRate(): number {
    const total = this.stats.hitCount + this.stats.missCount
    return total > 0 ? Math.round((this.stats.hitCount / total) * 100) : 0
  }

  /**
   * 导出缓存数据（用于持久化）
   */
  export(): Record<string, { data: string; timestamp: number }> {
    const exported: Record<string, { data: string; timestamp: number }> = {}
    
    for (const [key, entry] of this.cache.entries()) {
      if (!entry.isFailure && entry.data) {
        exported[key] = {
          data: entry.data,
          timestamp: entry.timestamp
        }
      }
    }
    
    return exported
  }

  /**
   * 导入缓存数据（用于持久化恢复）
   */
  import(data: Record<string, { data: string; timestamp: number }>): void {
    const now = Date.now()
    
    for (const [key, entry] of Object.entries(data)) {
      if (now - entry.timestamp <= this.maxAge) {
        const size = new Blob([entry.data]).size
        this.cache.set(key, {
          data: entry.data,
          timestamp: entry.timestamp,
          size,
          accessCount: 1,
          lastAccessed: now
        })
      }
    }
    
    this.updateStats()
  }
}

// 创建全局单例实例
export const imageCache = new ImageCacheManager()

// 导出类型
export type { CacheEntry, CacheStats }