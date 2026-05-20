export interface LuminanceHistogramResult {
  bins: Uint32Array
  total: number
  peak: number
  /** 暗部裁切：0–15 档累计占比 */
  clipShadow: number
  /** 高光裁切：240–255 档累计占比 */
  clipHighlight: number
}

const DEFAULT_MAX_EDGE = 320

function shouldUseCrossOrigin(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/**
 * 从图片 URL 计算亮度直方图（256 档），用于编辑器实时预览。
 */
export async function computeLuminanceHistogram(
  imageSrc: string,
  options?: { maxEdge?: number; signal?: { cancelled: boolean } }
): Promise<LuminanceHistogramResult> {
  const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE
  const empty: LuminanceHistogramResult = {
    bins: new Uint32Array(256),
    total: 0,
    peak: 0,
    clipShadow: 0,
    clipHighlight: 0,
  }

  if (!imageSrc) return empty

  return new Promise((resolve, reject) => {
    const img = new Image()
    if (shouldUseCrossOrigin(imageSrc)) {
      img.crossOrigin = 'anonymous'
    }

    img.onload = () => {
      if (options?.signal?.cancelled) {
        resolve(empty)
        return
      }
      try {
        const w = img.naturalWidth
        const h = img.naturalHeight
        if (w <= 0 || h <= 0) {
          resolve(empty)
          return
        }

        const scale = Math.min(1, maxEdge / Math.max(w, h))
        const cw = Math.max(1, Math.round(w * scale))
        const ch = Math.max(1, Math.round(h * scale))

        const canvas = document.createElement('canvas')
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          reject(new Error('无法创建 canvas 上下文'))
          return
        }

        ctx.drawImage(img, 0, 0, cw, ch)
        const data = ctx.getImageData(0, 0, cw, ch).data
        const bins = new Uint32Array(256)
        let total = 0
        let peak = 0

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const lum = Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b))
          bins[lum] += 1
          total += 1
          if (bins[lum] > peak) peak = bins[lum]
        }

        let shadowSum = 0
        let highlightSum = 0
        for (let j = 0; j <= 15; j++) shadowSum += bins[j]
        for (let j = 240; j < 256; j++) highlightSum += bins[j]

        resolve({
          bins,
          total,
          peak,
          clipShadow: total > 0 ? shadowSum / total : 0,
          clipHighlight: total > 0 ? highlightSum / total : 0,
        })
      } catch (e) {
        reject(e)
      }
    }

    img.onerror = () => reject(new Error('直方图采样：图片加载失败'))
    img.src = imageSrc
  })
}
