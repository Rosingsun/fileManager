/**
 * EXIF解析Hook
 */

import { useState, useEffect } from 'react'
import type { ExifData } from '../types'
import { formatExifData, extractExifFromUrl } from '../utils/exifParser'

export function useExifParser(exif: ExifData | null | undefined, imageUrl?: string) {
  const [formattedExif, setFormattedExif] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let isMounted = true

    // 如果已经提供了exif数据，直接使用
    if (exif) {
      const formatted = formatExifData(exif)
      setFormattedExif(formatted)
      return
    }

    // 如果没有提供exif数据但有图片URL，尝试从URL中提取
    if (imageUrl) {
      const fetchExifData = async () => {
        setIsLoading(true)
        try {
          const extractedExif = await extractExifFromUrl(imageUrl)
          if (isMounted) {
            const formatted = formatExifData(extractedExif)
            setFormattedExif(formatted)
          }
        } catch (error) {
          console.error('Failed to fetch EXIF data:', error)
          if (isMounted) {
            setFormattedExif({})
          }
        } finally {
          if (isMounted) {
            setIsLoading(false)
          }
        }
      }

      fetchExifData()
    } else {
      setFormattedExif({})
    }

    return () => {
      isMounted = false
    }
  }, [exif, imageUrl])

  return { formattedExif, isLoading }
}

