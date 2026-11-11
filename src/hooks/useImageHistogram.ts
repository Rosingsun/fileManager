import { useEffect, useRef, useState } from 'react'
import {
  computeLuminanceHistogram,
  type LuminanceHistogramResult,
} from '../utils'

const DEBOUNCE_MS = 280
const LARGE_IMAGE_PIXELS = 3840 * 2160

const EMPTY: LuminanceHistogramResult = {
  bins: new Uint32Array(256),
  total: 0,
  peak: 0,
  clipShadow: 0,
  clipHighlight: 0,
}

function deserializeHistogram(raw: {
  bins: number[]
  total: number
  peak: number
  clipShadow: number
  clipHighlight: number
  rgbBins?: { r: number[]; g: number[]; b: number[] }
}): LuminanceHistogramResult {
  const bins = Uint32Array.from(raw.bins)
  return {
    bins,
    total: raw.total,
    peak: raw.peak,
    clipShadow: raw.clipShadow,
    clipHighlight: raw.clipHighlight,
    rgbBins: raw.rgbBins
      ? {
          r: Uint32Array.from(raw.rgbBins.r),
          g: Uint32Array.from(raw.rgbBins.g),
          b: Uint32Array.from(raw.rgbBins.b),
        }
      : undefined,
  }
}

export function useImageHistogram(
  previewSrc: string | null | undefined,
  depsKey: string | number = '',
  options?: {
    filePath?: string
    pixelCount?: number
    /** 与画布一致的即时 CSS 滤镜，使直方图反映基础调整 */
    filterCss?: string
  }
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

    const useMainProcess =
      !!options?.filePath &&
      (options.pixelCount ?? 0) >= LARGE_IMAGE_PIXELS &&
      !!window.electronAPI?.getImageHistogram

    const timer = window.setTimeout(() => {
      const run = useMainProcess
        ? window.electronAPI!.getImageHistogram(options!.filePath!).then(deserializeHistogram)
        : computeLuminanceHistogram(previewSrc, { filterCss: options?.filterCss })

      void run
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
  }, [previewSrc, depsKey, options?.filePath, options?.pixelCount, options?.filterCss])

  return { histogram, loading, error }
}
