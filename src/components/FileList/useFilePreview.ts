import { useState, useEffect, useRef, useCallback } from 'react'
import { imageLoader, imageCache } from '../../utils'
import type { FileInfo } from '../../types'
import type { PreviewData } from './types'

interface UseFilePreviewOptions {
  enabled?: boolean
  maxImageSize?: number
}

export function useFilePreview(options: UseFilePreviewOptions = {}) {
  const { enabled = true, maxImageSize = 50 * 1024 * 1024 } = options

  const [previews, setPreviews] = useState<Map<string, PreviewData>>(new Map())
  const [visibleImages, setVisibleImages] = useState<Set<string>>(new Set())
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<Map<string, number>>(new Map())
  const [previewVersion, setPreviewVersion] = useState(0)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const imageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const fileListRef = useRef<FileInfo[]>([])

  const loadThumbnailWithProgress = useCallback(async (
    filePath: string,
    file: FileInfo
  ): Promise<{ data: string; fromCache: boolean }> => {
    const cacheKey = `thumb:${filePath}:300:80`
    const cached = imageCache.get(cacheKey)
    if (cached) {
      return { data: cached, fromCache: true }
    }

    setProgress(prev => {
      const m = new Map(prev)
      m.set(filePath, 0)
      return m
    })

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const m = new Map(prev)
        const currentProgress = m.get(filePath) || 0
        if (currentProgress < 90) {
          m.set(filePath, Math.min(currentProgress + Math.random() * 10, 90))
        }
        return m
      })
    }, 100)

    try {
      const result = await imageLoader.loadThumbnail(filePath, 300, 80, {
        useCache: true,
        timeout: 15000,
        retryCount: 2
      })

      clearInterval(progressInterval)
      setProgress(prev => {
        const m = new Map(prev)
        m.set(filePath, 100)
        return m
      })

      setTimeout(() => {
        setProgress(prev => {
          const m = new Map(prev)
          m.delete(filePath)
          return m
        })
      }, 300)

      return { data: result.data, fromCache: result.fromCache }
    } catch (error) {
      clearInterval(progressInterval)
      setProgress(prev => {
        const m = new Map(prev)
        m.delete(filePath)
        return m
      })
      throw error
    }
  }, [])

  const loadVisibleThumbnails = useCallback(async () => {
    const imagesToLoad = Array.from(visibleImages).filter(
      path => !previews.has(path) && !loadingImages.has(path)
    )

    if (imagesToLoad.length === 0) return

    setLoadingImages(prev => new Set([...prev, ...imagesToLoad]))

    const CONCURRENCY = 4
    let index = 0

    const sortedImages = imagesToLoad.sort((a, b) => {
      const fileA = fileListRef.current.find(f => f.path === a)
      const fileB = fileListRef.current.find(f => f.path === b)
      return (fileA?.size || 0) - (fileB?.size || 0)
    })

    const worker = async () => {
      while (true) {
        const i = index
        index += 1
        if (i >= sortedImages.length) break
        const filePath = sortedImages[i]

        const file = fileListRef.current.find(f => f.path === filePath)
        if (!file || file.size > maxImageSize) {
          setLoadingImages(prev => {
            const newSet = new Set(prev)
            newSet.delete(filePath)
            return newSet
          })
          continue
        }

        try {
          const result = await loadThumbnailWithProgress(filePath, file)

          setPreviews(prev => {
            const m = new Map(prev)
            m.set(filePath, { thumbnail: result.data, full: '' })
            return m
          })
          setPreviewVersion(v => v + 1)
        } catch (error) {
          setPreviews(prev => {
            const m = new Map(prev)
            m.set(filePath, { thumbnail: '', full: '' })
            return m
          })
        } finally {
          setLoadingImages(prev => {
            const newSet = new Set(prev)
            newSet.delete(filePath)
            return newSet
          })
        }

        await new Promise(res => setTimeout(res, 500))
      }
    }

    const workers: Promise<void>[] = []
    for (let w = 0; w < Math.min(CONCURRENCY, sortedImages.length); w++) {
      workers.push(worker())
    }

    await Promise.allSettled(workers)
  }, [visibleImages, loadingImages, previews, maxImageSize, loadThumbnailWithProgress])

  useEffect(() => {
    if (!enabled || visibleImages.size === 0) return
    loadVisibleThumbnails()
  }, [visibleImages, enabled, loadVisibleThumbnails])

  useEffect(() => {
    if (!enabled) {
      setPreviews(new Map())
      setVisibleImages(new Set())
      setLoadingImages(new Set())
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const filePath = (entry.target as HTMLElement).dataset.filePath
          if (!filePath) return

          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            setVisibleImages(prev => {
              if (!prev.has(filePath)) {
                return new Set([...prev, filePath])
              }
              return prev
            })
          }
        })
      },
      {
        rootMargin: '200px',
        threshold: 0.01
      }
    )

    observerRef.current = observer

    return () => {
      observer.disconnect()
    }
  }, [enabled])

  const setFiles = useCallback((files: FileInfo[]) => {
    fileListRef.current = files
  }, [])

  const clearCache = useCallback(() => {
    setPreviews(new Map())
    setVisibleImages(new Set())
    setLoadingImages(new Set())
    setProgress(new Map())
    imageRefs.current.clear()
  }, [])

  const registerImageRef = useCallback((filePath: string, el: HTMLDivElement | null) => {
    if (el) {
      imageRefs.current.set(filePath, el)
      observerRef.current?.observe(el)
    } else {
      imageRefs.current.delete(filePath)
    }
  }, [])

  return {
    previews,
    visibleImages,
    loadingImages,
    progress,
    previewVersion,
    setFiles,
    clearCache,
    registerImageRef,
    maxImageSize
  }
}
