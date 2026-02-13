export function inferCategoryFromImageInfo(info: { width?: number; height?: number; format?: string; exif?: Record<string, any> }): string | null {
  const { width, height, exif } = info

  if (width && height && exif) {
    const aspectRatio = width / height
    if (aspectRatio > 1.5 && exif.camera) {
      return 'landscape'
    }
  }

  if (width && height) {
    const aspectRatio = width / height
    if (aspectRatio < 0.8) {
      return 'person'
    }
  }

  return null
}

export function mapToCustomCategory(imagenetClass: string, categoryMapping: Array<{ keywords: Array<{ word: string; weight?: number }>; category: string }>): { category: string; confidence: number } {
  const lowerClass = imagenetClass.toLowerCase().trim()
  const words = lowerClass.split(/\s+/).filter(w => w.length >= 2)

  const categoryScores: Record<string, number> = {}

  for (const mapping of categoryMapping) {
    categoryScores[mapping.category] = 0
  }

  for (const mapping of categoryMapping) {
    for (const keyword of mapping.keywords) {
      const keywordStr = typeof keyword === 'string' ? keyword : keyword.word
      const weight = typeof keyword === 'string' ? 1 : (keyword.weight || 1)
      const lowerKeyword = keywordStr.toLowerCase().trim()

      if (lowerClass === lowerKeyword) {
        categoryScores[mapping.category] += weight * 10
        continue
      }

      if (lowerClass.includes(lowerKeyword) && lowerKeyword.length >= 4) {
        categoryScores[mapping.category] += weight * 5
        continue
      }

      for (const word of words) {
        if (word === lowerKeyword) {
          categoryScores[mapping.category] += weight * 8
        } else if (lowerKeyword.includes(word) && lowerKeyword.length > word.length && word.length >= 3) {
          categoryScores[mapping.category] += weight * 6
        } else if (word.includes(lowerKeyword) && word.length > lowerKeyword.length && lowerKeyword.length >= 3) {
          categoryScores[mapping.category] += weight * 3
        }
      }
    }
  }

  let maxScore = 0
  let bestCategory = 'other'

  for (const [category, score] of Object.entries(categoryScores)) {
    if (score > maxScore) {
      maxScore = score
      bestCategory = category
    }
  }

  const confidence = Math.min(1, maxScore / 50)

  if (maxScore < 3) {
    console.log(`[分类] 未识别类别: "${imagenetClass}" -> 其他 (得分: ${maxScore})`)
    return { category: 'other', confidence: 0 }
  }

  console.log(`[分类] 类别映射: "${imagenetClass}" -> ${bestCategory} (得分: ${maxScore}, 置信度: ${confidence.toFixed(2)})`)
  return { category: bestCategory, confidence }
}
