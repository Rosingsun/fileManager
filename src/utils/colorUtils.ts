/**
 * 颜色处理工具函数
 */

import type { ColorInfo } from '../types'

/**
 * 从图片中提取主要颜色
 * @param imageUrl 图片URL
 * @param colorCount 要提取的颜色数量（1-4）
 * @returns 颜色信息数组
 */
export async function extractDominantColors(
  imageUrl: string,
  colorCount: number = 4
): Promise<ColorInfo[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('无法创建canvas上下文'))
          return
        }
        
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        
        // 采样像素（为了提高性能，可以降低采样率）
        const sampleRate = 10 // 每10个像素采样一次
        const pixels: { r: number; g: number; b: number }[] = []
        
        for (let y = 0; y < canvas.height; y += sampleRate) {
          for (let x = 0; x < canvas.width; x += sampleRate) {
            const pixelData = ctx.getImageData(x, y, 1, 1).data
            pixels.push({
              r: pixelData[0],
              g: pixelData[1],
              b: pixelData[2]
            })
          }
        }
        
        // 使用K-means算法或简单聚类提取主要颜色
        const colors = extractColorsByClustering(pixels, colorCount)
        resolve(colors)
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      reject(new Error('图片加载失败'))
    }
    
    img.src = imageUrl
  })
}

/**
 * 使用简单的聚类算法提取颜色
 */
function extractColorsByClustering(
  pixels: { r: number; g: number; b: number }[],
  k: number
): ColorInfo[] {
  if (pixels.length === 0) {
    // 如果没有像素，返回默认颜色
    return Array.from({ length: k }, (_, i) => ({
      hex: ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'][i % 8],
      rgb: { r: 255, g: 255, b: 255 },
      percentage: 100 / k
    }))
  }
  
  // 简化版：使用颜色直方图方法
  // 将颜色空间划分为若干区域，统计每个区域的颜色数量
  const buckets: Map<string, { r: number; g: number; b: number; count: number }> = new Map()
  const bucketSize = 32 // 将256色阶划分为8个区间
  
  pixels.forEach(pixel => {
    const bucketKey = `${Math.floor(pixel.r / bucketSize)}-${Math.floor(pixel.g / bucketSize)}-${Math.floor(pixel.b / bucketSize)}`
    const existing = buckets.get(bucketKey)
    
    if (existing) {
      existing.r += pixel.r
      existing.g += pixel.g
      existing.b += pixel.b
      existing.count += 1
    } else {
      buckets.set(bucketKey, {
        r: pixel.r,
        g: pixel.g,
        b: pixel.b,
        count: 1
      })
    }
  })
  
  // 按数量排序，取前k个
  let sortedBuckets = Array.from(buckets.entries())
    .map(([key, value]) => ({
      key,
      r: Math.round(value.r / value.count),
      g: Math.round(value.g / value.count),
      b: Math.round(value.b / value.count),
      count: value.count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, k)
  
  const totalPixels = pixels.length
  
  // 如果提取的颜色数量不足k个，补充一些颜色
  if (sortedBuckets.length < k) {
    // 复制现有颜色或生成一些变化的颜色
    const baseColors = [...sortedBuckets]
    while (sortedBuckets.length < k) {
      // 从已有颜色中随机选择并生成类似的颜色
      const randomColor = baseColors[Math.floor(Math.random() * baseColors.length)]
      const variation = 20 // 颜色变化幅度
      
      // 生成一个略有不同的颜色
      const newColor = {
        ...randomColor,
        r: Math.max(0, Math.min(255, randomColor.r + (Math.random() * variation * 2 - variation))),
        g: Math.max(0, Math.min(255, randomColor.g + (Math.random() * variation * 2 - variation))),
        b: Math.max(0, Math.min(255, randomColor.b + (Math.random() * variation * 2 - variation)))
      }
      
      sortedBuckets.push(newColor)
    }
  }
  
  return sortedBuckets.map(bucket => ({
    hex: rgbToHex(bucket.r, bucket.g, bucket.b),
    rgb: { r: bucket.r, g: bucket.g, b: bucket.b },
    percentage: (bucket.count / totalPixels) * 100
  }))
}

/**
 * RGB转HEX
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')}`
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    // 降级方案
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    
    try {
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    } catch (err) {
      document.body.removeChild(textArea)
      return false
    }
  }
}

