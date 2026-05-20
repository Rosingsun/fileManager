import { useEffect, useRef, useState } from 'react'
import { computeLuminanceHistogram, type LuminanceHistogramResult } from '../utils'

const DEBOUNCE_MS = 280

const EMPTY: LuminanceHistogramResult = {
  bins: new Uint32Array(256),
  total: 0,
  peak: 0,
  clipShadow: 0,
  clipHighlight: 0,
}

export function useImageHistogram(
  previewSrc: string | null | undefined,
  depsKey: string | number = ''
): {
  histogram: LuminanceHistogramResult
  loading: boolean
  error: string | null
} {
  const [histogram, setHistogram] = useState<LuminanceHistogramResult>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const genRef = useRef(0)

  useEffect(() => {
    if (!previewSrc) {
      setHistogram(EMPTY)
      setLoading(false)
      setError(null)
      return
    }

    const gen = ++genRef.current
    setLoading(true)
    setError(null)

    const timer = window.setTimeout(() => {
      void computeLuminanceHistogram(previewSrc)
        .then(result => {
          if (gen !== genRef.current) return
          setHistogram(result)
          setLoading(false)
        })
        .catch((e: unknown) => {
          if (gen !== genRef.current) return
          setHistogram(EMPTY)
          setLoading(false)
          setError(e instanceof Error ? e.message : '直方图计算失败')
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      genRef.current++
    }
  }, [previewSrc, depsKey])

  return { histogram, loading, error }
}
