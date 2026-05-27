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

    // 若传入 exif 且能格式化为可展示字段，直接使用；否则继续尝试从 URL 解析
    if (exif != null) {
      const formatted = formatExifData(exif)
      if (Object.keys(formatted).length > 0) {
        setFormattedExif(formatted)
        setIsLoading(false)
        return () => {
          isMounted = false
        }
      }
    }

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
      setIsLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [exif, imageUrl])

  return { formattedExif, isLoading }
}

