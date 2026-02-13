import crypto from 'crypto'
import sharp from 'sharp'

export function calculateFileHash(fileBuffer: Buffer): string {
  return crypto.createHash('md5').update(fileBuffer).digest('hex')
}

export async function calculatePerceptualHash(imageBuffer: Buffer): Promise<string> {
  try {
    const resized = await sharp(imageBuffer)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer()

    let sum = 0
    for (let i = 0; i < resized.length; i++) {
      sum += resized[i]
    }
    const average = sum / resized.length

    let hash = ''
    for (let i = 0; i < resized.length; i++) {
      hash += resized[i] > average ? '1' : '0'
    }

    return hash
  } catch (error) {
    console.error('[Main] 计算感知哈希失败:', error)
    return ''
  }
}

export function calculateSimilarity(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 0

  let differences = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) differences++
  }

  return Math.round(((hash1.length - differences) / hash1.length) * 10000) / 100
}

export function recommendKeepImage(images: Array<{
  filePath: string
  width?: number
  height?: number
  size: number
  modifiedTime: number
  perceptualHash?: string
}>): string {
  if (images.length === 0) return ''
  if (images.length === 1) return images[0].filePath

  const scores = images.map(img => {
    let score = 0
    if (img.width && img.height) {
      const pixels = img.width * img.height
      const maxPixels = Math.max(...images.map(i => (i.width || 0) * (i.height || 0)))
      score += (pixels / maxPixels) * 40
    }
    const maxSize = Math.max(...images.map(i => i.size))
    score += (img.size / maxSize) * 30
    const maxTime = Math.max(...images.map(i => i.modifiedTime))
    score += (img.modifiedTime / maxTime) * 20
    if (img.perceptualHash) score += 10
    return { path: img.filePath, score }
  })

  scores.sort((a, b) => b.score - a.score)
  return scores[0].path
}
