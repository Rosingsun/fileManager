import type { ImageHash, SimilarityGroup } from '../types'
import { createHash } from 'crypto'

export const calculateFileHash = async (_filePath: string, fileBuffer: Buffer): Promise<string> => {
  return createHash('md5').update(fileBuffer).digest('hex')
}

export const calculatePerceptualHash = async (
  imageBuffer: Buffer,
  sharp: any
): Promise<string> => {
  try {
    const resized = await sharp(imageBuffer)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer()

    const sum = resized.reduce((acc: number, val: number) => acc + val, 0)
    const average = sum / resized.length

    return resized.map((val: number) => val > average ? '1' : '0').join('')
  } catch {
    return ''
  }
}

export const calculateSimilarity = (hash1: string, hash2: string): number => {
  if (hash1.length !== hash2.length) return 0

  let differences = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) differences++
  }

  return Math.round(((hash1.length - differences) / hash1.length) * 10000) / 100
}

export const recommendKeepImage = (images: ImageHash[]): string => {
  if (images.length <= 1) return images[0]?.filePath || ''

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

  return scores.sort((a, b) => b.score - a.score)[0].path
}

export const groupSimilarImages = (
  images: ImageHash[],
  threshold: number,
  usePerceptualHash: boolean = true
): SimilarityGroup[] => {
  const groups: SimilarityGroup[] = []
  const processed = new Set<string>()

  for (let i = 0; i < images.length; i++) {
    const currentImage = images[i]
    if (processed.has(currentImage.filePath)) continue

    const group: ImageHash[] = [currentImage]
    processed.add(currentImage.filePath)

    for (let j = i + 1; j < images.length; j++) {
      const nextImage = images[j]
      if (processed.has(nextImage.filePath)) continue

      let similarity = 0

      if (currentImage.fileHash === nextImage.fileHash) {
        similarity = 100
      } else if (usePerceptualHash && currentImage.perceptualHash && nextImage.perceptualHash) {
        similarity = calculateSimilarity(currentImage.perceptualHash, nextImage.perceptualHash)
      }

      if (similarity >= threshold) {
        group.push(nextImage)
        processed.add(nextImage.filePath)
      }
    }

    if (group.length >= 2) {
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

