import { join } from 'path'
import fs from 'fs-extra'
import { stat, readdir } from 'fs-extra'
import { calculateFileHash, calculatePerceptualHash, calculateSimilarity, recommendKeepImage } from '../utils/similarityUtils'
import { IMAGE_EXTENSIONS } from '../utils/fileUtils'
import type { SimilarityScanConfig, ImageHash, SimilarityGroup, SimilarityScanResult, SimilarityScanProgress } from '../../../src/types'

export function groupSimilarImages(images: ImageHash[], threshold: number, usePerceptualHash: boolean): SimilarityGroup[] {
  const groups: SimilarityGroup[] = []
  const processed = new Set<string>()

  for (let i = 0; i < images.length; i++) {
    if (processed.has(images[i].filePath)) continue

    const group: ImageHash[] = [images[i]]
    processed.add(images[i].filePath)

    for (let j = i + 1; j < images.length; j++) {
      if (processed.has(images[j].filePath)) continue

      let similarity = 0
      if (images[i].fileHash === images[j].fileHash) {
        similarity = 100
      } else if (usePerceptualHash && images[i].perceptualHash && images[j].perceptualHash) {
        similarity = calculateSimilarity(images[i].perceptualHash!, images[j].perceptualHash!)
      }

      if (similarity >= threshold) {
        group.push(images[j])
        processed.add(images[j].filePath)
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

export async function scanImageFiles(config: SimilarityScanConfig): Promise<string[]> {
  const imageFiles: string[] = []
  const excludedPaths = new Set(config.excludedFolders || [])
  const excludedExts = new Set((config.excludedExtensions || []).map(ext => ext.toLowerCase()))

  async function traverse(currentPath: string) {
    try {
      const items = await readdir(currentPath)
      
      for (const item of items) {
        const fullPath = join(currentPath, item)
        const stats = await stat(fullPath)
        
        if (stats.isDirectory()) {
          if (!excludedPaths.has(fullPath) && config.includeSubdirectories) {
            await traverse(fullPath)
          }
        } else {
          const ext = item.split('.').pop()?.toLowerCase() || ''
          if (IMAGE_EXTENSIONS.includes(ext) && !excludedExts.has(ext)) {
            if (config.minFileSize && stats.size < config.minFileSize) continue
            if (config.maxFileSize && stats.size > config.maxFileSize) continue
            imageFiles.push(fullPath)
          }
        }
      }
    } catch (error) {
      console.error(`[Main] 遍历目录失败 ${currentPath}:`, error)
    }
  }

  await traverse(config.scanPath)
  return imageFiles
}

export async function scanSimilarImages(
  config: SimilarityScanConfig,
  onProgress: (progress: Partial<SimilarityScanProgress>) => void
): Promise<SimilarityScanResult> {
  const startTime = Date.now()
  let currentProgress = 0
  let totalFiles = 0

  onProgress({ status: 'scanning', currentFile: '正在扫描图片文件...' })
  const imageFiles = await scanImageFiles(config)
  totalFiles = imageFiles.length
  console.log(`[Main] 找到 ${totalFiles} 张图片`)

  if (totalFiles === 0) {
    return {
      groups: [],
      totalImages: 0,
      totalGroups: 0,
      potentialSpaceSaved: 0,
      scanTime: Date.now() - startTime
    }
  }

  onProgress({ status: 'hashing', currentFile: '正在计算哈希值...' })
  const imageHashes: ImageHash[] = []
  const usePerceptualHash = config.algorithm === 'phash' || config.algorithm === 'both'

  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = imageFiles[i]
    currentProgress = i + 1
    onProgress({ 
      status: 'hashing', 
      currentFile: filePath,
      current: currentProgress,
      total: totalFiles
    })

    try {
      const fileBuffer = await fs.readFile(filePath)
      const fileHash = calculateFileHash(fileBuffer)
      const stats = await stat(filePath)

      let perceptualHash: string | undefined
      let width: number | undefined
      let height: number | undefined

      if (usePerceptualHash) {
        try {
          const sharp = (await import('sharp')).default
          const metadata = await sharp(fileBuffer).metadata()
          width = metadata.width
          height = metadata.height
          perceptualHash = await calculatePerceptualHash(fileBuffer)
        } catch (error) {
          console.warn(`[Main] 无法处理图片 ${filePath}:`, error)
        }
      }

      imageHashes.push({
        filePath,
        fileHash,
        perceptualHash,
        width,
        height,
        size: stats.size,
        modifiedTime: stats.mtime.getTime()
      })
    } catch (error) {
      console.error(`[Main] 处理文件失败 ${filePath}:`, error)
    }
  }

  onProgress({ status: 'comparing', currentFile: '正在对比相似照片...' })
  const groups = groupSimilarImages(imageHashes, config.similarityThreshold, usePerceptualHash)

  let potentialSpaceSaved = 0
  for (const group of groups) {
    const keepPath = group.recommendedKeep || group.images[0].filePath
    for (const img of group.images) {
      if (img.filePath !== keepPath) {
        potentialSpaceSaved += img.size
      }
    }
  }

  onProgress({ 
    status: 'completed', 
    groupsFound: groups.length,
    current: totalFiles,
    total: totalFiles
  })

  return {
    groups,
    totalImages: imageHashes.length,
    totalGroups: groups.length,
    potentialSpaceSaved,
    scanTime: Date.now() - startTime
  }
}
