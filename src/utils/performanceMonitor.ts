/**
 * 图片预览性能监控器
 * 提供性能指标收集、分析和报告功能
 */

interface PerformanceMetrics {
  loadTime: number
  fileSize: number
  cacheHit: boolean
  imageType: 'thumbnail' | 'original'
  success: boolean
  timestamp: number
}

interface PerformanceReport {
  averageLoadTime: number
  cacheHitRate: number
  successRate: number
  totalLoaded: number
  totalFailed: number
  averageFileSize: number
  memoryUsage: number
}

export class ImagePerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private maxMetricsCount = 1000

  /**
   * 记录性能指标
   */
  record(metric: Omit<PerformanceMetrics, 'timestamp'>): void {
    const fullMetric: PerformanceMetrics = {
      ...metric,
      timestamp: Date.now()
    }

    this.metrics.push(fullMetric)
    
    // 限制指标数量，避免内存泄漏
    if (this.metrics.length > this.maxMetricsCount) {
      this.metrics = this.metrics.slice(-this.maxMetricsCount)
    }
  }

  /**
   * 生成性能报告
   */
  generateReport(): PerformanceReport {
    if (this.metrics.length === 0) {
      return {
        averageLoadTime: 0,
        cacheHitRate: 0,
        successRate: 0,
        totalLoaded: 0,
        totalFailed: 0,
        averageFileSize: 0,
        memoryUsage: 0
      }
    }

    const successful = this.metrics.filter(m => m.success)
    const cacheHits = this.metrics.filter(m => m.cacheHit)
    const failed = this.metrics.filter(m => !m.success)

    const totalLoadTime = successful.reduce((sum, m) => sum + m.loadTime, 0)
    const totalFileSize = successful.reduce((sum, m) => sum + m.fileSize, 0)

    return {
      averageLoadTime: successful.length > 0 ? totalLoadTime / successful.length : 0,
      cacheHitRate: (cacheHits.length / this.metrics.length) * 100,
      successRate: (successful.length / this.metrics.length) * 100,
      totalLoaded: successful.length,
      totalFailed: failed.length,
      averageFileSize: successful.length > 0 ? totalFileSize / successful.length : 0,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  /**
   * 估算内存使用量
   */
  private estimateMemoryUsage(): number {
    return this.metrics.length * 200 // 估算每个指标占用200字节
  }

  /**
   * 获取最近N分钟的指标
   */
  getRecentMetrics(minutes: number = 5): PerformanceMetrics[] {
    const cutoff = Date.now() - minutes * 60 * 1000
    return this.metrics.filter(m => m.timestamp >= cutoff)
  }

  /**
   * 按图片类型分组统计
   */
  getStatsByType(): { thumbnail: PerformanceReport; original: PerformanceReport } {
    const thumbnails = this.metrics.filter(m => m.imageType === 'thumbnail')
    const originals = this.metrics.filter(m => m.imageType === 'original')

    return {
      thumbnail: this.calculateReport(thumbnails),
      original: this.calculateReport(originals)
    }
  }

  /**
   * 计算指定指标数组的报告
   */
  private calculateReport(metrics: PerformanceMetrics[]): PerformanceReport {
    if (metrics.length === 0) {
      return {
        averageLoadTime: 0,
        cacheHitRate: 0,
        successRate: 0,
        totalLoaded: 0,
        totalFailed: 0,
        averageFileSize: 0,
        memoryUsage: 0
      }
    }

    const successful = metrics.filter(m => m.success)
    const cacheHits = metrics.filter(m => m.cacheHit)

    const totalLoadTime = successful.reduce((sum, m) => sum + m.loadTime, 0)
    const totalFileSize = successful.reduce((sum, m) => sum + m.fileSize, 0)

    return {
      averageLoadTime: successful.length > 0 ? totalLoadTime / successful.length : 0,
      cacheHitRate: metrics.length > 0 ? (cacheHits.length / metrics.length) * 100 : 0,
      successRate: (successful.length / metrics.length) * 100,
      totalLoaded: successful.length,
      totalFailed: metrics.length - successful.length,
      averageFileSize: successful.length > 0 ? totalFileSize / successful.length : 0,
      memoryUsage: 0
    }
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.metrics = []
  }

  /**
   * 获取慢加载的图片（加载时间超过阈值）
   */
  getSlowImages(thresholdMs: number = 3000): PerformanceMetrics[] {
    return this.metrics
      .filter(m => m.loadTime > thresholdMs && m.success)
      .sort((a, b) => b.loadTime - a.loadTime)
  }

  /**
   * 获取频繁失败的图片
   */
  getFailingImages(): { path: string; failCount: number; lastFailure: number }[] {
    const failureMap = new Map<string, { count: number; lastFailure: number }>()

    for (const metric of this.metrics.filter(m => !m.success)) {
      // 假设文件路径可以从某个地方获取，这里简化处理
      const key = `image_${metric.timestamp}` // 实际应用中应该是文件路径
      
      const existing = failureMap.get(key) || { count: 0, lastFailure: 0 }
      failureMap.set(key, {
        count: existing.count + 1,
        lastFailure: Math.max(existing.lastFailure, metric.timestamp)
      })
    }

    return Array.from(failureMap.entries()).map(([path, data]) => ({
      path,
      failCount: data.count,
      lastFailure: data.lastFailure
    }))
  }

  /**
   * 导出性能数据
   */
  exportData(): string {
    return JSON.stringify({
      metrics: this.metrics,
      report: this.generateReport(),
      exportedAt: Date.now()
    }, null, 2)
  }

  /**
   * 打印性能报告到控制台
   */
  printReport(): void {
    const report = this.generateReport()
    const typeStats = this.getStatsByType()
    const slowImages = this.getSlowImages()

    console.group('🖼️ 图片预览性能报告')
    console.log('📊 总体指标:')
    console.log(`   平均加载时间: ${report.averageLoadTime.toFixed(0)}ms`)
    console.log(`   缓存命中率: ${report.cacheHitRate.toFixed(1)}%`)
    console.log(`   成功率: ${report.successRate.toFixed(1)}%`)
    console.log(`   已加载: ${report.totalLoaded} | 失败: ${report.totalFailed}`)
    console.log(`   平均文件大小: ${(report.averageFileSize / 1024).toFixed(1)}KB`)

    console.log('📈 分类统计:')
    console.log(`   缩略图 - 平均: ${typeStats.thumbnail.averageLoadTime.toFixed(0)}ms, 成功率: ${typeStats.thumbnail.successRate.toFixed(1)}%`)
    console.log(`   原图 - 平均: ${typeStats.original.averageLoadTime.toFixed(0)}ms, 成功率: ${typeStats.original.successRate.toFixed(1)}%`)

    if (slowImages.length > 0) {
      console.log('🐌 慢加载图片 (>3s):')
      slowImages.slice(0, 5).forEach((img, index) => {
        console.log(`   ${index + 1}. ${(img.loadTime / 1000).toFixed(1)}s`)
      })
    }

    console.groupEnd()
  }
}

// 创建全局实例
export const performanceMonitor = new ImagePerformanceMonitor()

// 性能装饰器函数
export function withPerformanceTracking<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: { imageType: 'thumbnail' | 'original'; getFileSize?: () => number } = { imageType: 'thumbnail' }
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now()
    let fileSize = 0
    let success = false
    let cacheHit = false

    try {
      // 尝试获取文件大小
      if (options.getFileSize) {
        fileSize = options.getFileSize() || 0
      }

      const result = await fn(...args)
      success = true

      // 检查结果是否可能来自缓存
      if (typeof result === 'string') {
        cacheHit = result.includes('data:image/') && result.length < 100000 // 简单的缓存判断
      }

      return result
    } finally {
      const loadTime = Date.now() - startTime
      
      performanceMonitor.record({
        loadTime,
        fileSize,
        cacheHit,
        imageType: options.imageType,
        success
      })
    }
  }
}

// 导出类型
export type { PerformanceMetrics, PerformanceReport }