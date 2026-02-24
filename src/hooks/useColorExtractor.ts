/**
 * 颜色提取Hook
 */

import { useState, useEffect } from 'react'
import type { ColorInfo } from '../components/ImageViewer/types'
import { extractDominantColors } from '../utils/colorUtils'

export function useColorExtractor(imageUrl: string | null, colorCount: number = 4) {
  const [colors, setColors] = useState<ColorInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!imageUrl) {
      setColors([])
      return
    }

    setIsLoading(true)
    setError(null)

    extractDominantColors(imageUrl, colorCount)
      .then(extractedColors => {
        setColors(extractedColors)
        setIsLoading(false)
      })
      .catch(err => {
        setError(err)
        setIsLoading(false)
        setColors([])
      })
  }, [imageUrl, colorCount])

  return { colors, isLoading, error }
}

