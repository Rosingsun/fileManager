/**
 * EXIF解析Hook
 */

import { useState, useEffect } from 'react'
import type { ExifData } from '../types'
import { formatExifData } from '../utils/exifParser'

export function useExifParser(exif: ExifData | null | undefined) {
  const [formattedExif, setFormattedExif] = useState<Record<string, string>>({})

  useEffect(() => {
    if (exif) {
      const formatted = formatExifData(exif)
      setFormattedExif(formatted)
    } else {
      setFormattedExif({})
    }
  }, [exif])

  return formattedExif
}

