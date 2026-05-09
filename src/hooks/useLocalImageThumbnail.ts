import { useEffect, useState } from 'react'

export interface UseLocalImageThumbnailOptions {
  maxEdge?: number
  quality?: number
}

/**
 * 在 Electron + http(s) 页面中加载本地图片缩略图（避免 file:// 被 webSecurity 拦截）
 */
export function useLocalImageThumbnail(
  filePath: string | undefined | null,
  options?: UseLocalImageThumbnailOptions
): { src: string | null; loading: boolean } {
  const maxEdge = options?.maxEdge ?? 240
  const quality = options?.quality ?? 75
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const path = filePath?.trim()
    if (!path) {
      setSrc(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setSrc(null)

    void (async () => {
      try {
        if (!window.electronAPI?.getImageThumbnail) {
          if (!cancelled) setSrc(null)
          return
        }
        const thumb = await window.electronAPI.getImageThumbnail(path, maxEdge, quality)
        if (!cancelled && thumb) setSrc(thumb)
      } catch {
        if (!cancelled) setSrc(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filePath, maxEdge, quality])

  return { src, loading }
}
