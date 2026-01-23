import type { ImageHash, SimilarityGroup, SimilarityScanConfig } from '../types'

/**
 * 计算文件的MD5哈希值
 */
export async function calculateFileHash(filePath: string, fileBuffer: Buffer): Promise<string> {
  // 使用 Node.js 内置的 crypto 模块（在主进程中）
  const crypto = require('crypto')
  return crypto.createHash('md5').update(fileBuffer).digest('hex')
}

/**
 * 计算感知哈希（pHash）
 * 将图片缩放到8x8，转换为灰度，计算平均值，生成64位哈希
 */
export async function calculatePerceptualHash(
  imageBuffer: Buffer,
  sharp: any
): Promise<string> {
  try {
    // 使用 sharp 处理图片
    const resized = await sharp(imageBuffer)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer()

    // 计算平均值
    let sum = 0
    for (let i = 0; i < resized.length; i++) {
      sum += resized[i]
    }
    const average = sum / resized.length

    // 生成哈希：大于平均值则为1，否则为0
    let hash = ''
    for (let i = 0; i < resized.length; i++) {
      hash += resized[i] > average ? '1' : '0'
    }

    return hash
  } catch (error) {
    console.error('计算感知哈希失败:', error)
    return ''
  }
}

/**
 * 计算两个哈希值的汉明距离（相似度）
 * 返回相似度百分比（0-100）
 */
export function calculateSimilarity(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return 0
  }

  let differences = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      differences++
    }
  }

  // 转换为相似度百分比
  const similarity = ((hash1.length - differences) / hash1.length) * 100
  return Math.round(similarity * 100) / 100
}

/**
 * 推荐保留哪张照片
 * 根据分辨率、文件大小、拍摄时间等综合判断
 */
export function recommendKeepImage(images: ImageHash[]): string {
  if (images.length === 0) return ''
  if (images.length === 1) return images[0].filePath

  // 评分系统
  const scores = images.map(img => {
    let score = 0

    // 分辨率评分（40%）
    if (img.width && img.height) {
      const pixels = img.width * img.height
      const maxPixels = Math.max(...images.map(i => (i.width || 0) * (i.height || 0)))
      score += (pixels / maxPixels) * 40
    }

    // 文件大小评分（30%）- 更大的文件通常质量更好
    const maxSize = Math.max(...images.map(i => i.size))
    score += (img.size / maxSize) * 30

    // 时间评分（20%）- 保留最新的
    const maxTime = Math.max(...images.map(i => i.modifiedTime))
    score += (img.modifiedTime / maxTime) * 20

    // 有感知哈希的优先（10%）
    if (img.perceptualHash) {
      score += 10
    }

    return { path: img.filePath, score }
  })

  // 返回得分最高的
  scores.sort((a, b) => b.score - a.score)
  return scores[0].path
}

/**
 * 分组相似照片
 */
export function groupSimilarImages(
  images: ImageHash[],
  threshold: number,
  usePerceptualHash: boolean = true
): SimilarityGroup[] {
  const groups: SimilarityGroup[] = []
  const processed = new Set<string>()

  for (let i = 0; i < images.length; i++) {
    if (processed.has(images[i].filePath)) continue

    const group: ImageHash[] = [images[i]]
    processed.add(images[i].filePath)

    // 查找相似的照片
    for (let j = i + 1; j < images.length; j++) {
      if (processed.has(images[j].filePath)) continue

      let similarity = 0

      // 首先检查文件哈希（完全相同的文件）
      if (images[i].fileHash === images[j].fileHash) {
        similarity = 100
      } else if (usePerceptualHash && images[i].perceptualHash && images[j].perceptualHash) {
        // 使用感知哈希计算相似度
        similarity = calculateSimilarity(images[i].perceptualHash!, images[j].perceptualHash!)
      }

      if (similarity >= threshold) {
        group.push(images[j])
        processed.add(images[j].filePath)
      }
    }

    // 只有2张或以上的照片才形成组
    if (group.length >= 2) {
      // 计算平均相似度
      let totalSimilarity = 0
      let count = 0
      for (let k = 0; k < group.length; k++) {
        for (let l = k + 1; l < group.length; l++) {
          if (group[k].fileHash === group[l].fileHash) {
            totalSimilarity += 100
          } else if (usePerceptualHash && group[k].perceptualHash && group[l].perceptualHash) {
            totalSimilarity += calculateSimilarity(group[k].perceptualHash!, group[l].perceptualHash!)
          }
          count++
        }
      }
      const avgSimilarity = count > 0 ? totalSimilarity / count : 0

      groups.push({
        id: `group-${groups.length + 1}`,
        images: group,
        similarity: Math.round(avgSimilarity * 100) / 100,
        recommendedKeep: recommendKeepImage(group)
      })
    }
  }

  return groups
}

