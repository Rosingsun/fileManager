import type { ImageContentCategory } from '../../../src/types'
import type { NineProbabilities, ClassificationStatus } from './types'

export function argmaxNine(nine: NineProbabilities): { category: ImageContentCategory; confidence: number } {
  let best: ImageContentCategory = 'other'
  let max = -1
  for (const k of Object.keys(nine) as ImageContentCategory[]) {
    if (nine[k] > max) {
      max = nine[k]
      best = k
    }
  }
  return { category: best, confidence: Math.min(1, Math.max(0, max)) }
}

export function nineProbabilitiesToTopPredictions(
  nine: NineProbabilities,
  maxItems = 3,
  minProb = 0.05,
  margin = 0.02
): Array<{ category: ImageContentCategory; confidence: number }> {
  const entries = (Object.keys(nine) as ImageContentCategory[])
    .map(k => ({ category: k, confidence: nine[k] }))
    .sort((a, b) => b.confidence - a.confidence)

  const top = entries[0]
  const filtered = entries.filter((e, i) => {
    if (i === 0) return true
    if (e.confidence < minProb) return false
    if (top.confidence - e.confidence < margin && i <= 2) return true
    return i < maxItems && e.confidence >= minProb
  })
  return filtered.slice(0, maxItems).map(e => ({
    category: e.category,
    confidence: Math.min(1, Math.max(0, e.confidence))
  }))
}

export function getTopMargin(nine: NineProbabilities): { top: number; margin: number } {
  const vals = (Object.keys(nine) as ImageContentCategory[]).map(k => nine[k]).sort((a, b) => b - a)
  return { top: vals[0] ?? 0, margin: (vals[0] ?? 0) - (vals[1] ?? 0) }
}

export function applyConfidenceGate(
  nine: NineProbabilities,
  confMin: number,
  marginMin: number,
  uncertainScaleMin: number
): { nine: NineProbabilities; confidenceScale: number; status: ClassificationStatus } {
  const { top, margin } = getTopMargin(nine)

  if (margin >= marginMin || top >= confMin) {
    return { nine, confidenceScale: 1, status: 'ok' }
  }

  const scale = Math.max(uncertainScaleMin, uncertainScaleMin + (margin / marginMin) * (1 - uncertainScaleMin))
  return { nine, confidenceScale: scale, status: 'uncertain' }
}

export function blendNine(
  primary: NineProbabilities,
  secondary: NineProbabilities,
  primaryWeight: number
): NineProbabilities {
  const w = primaryWeight
  const iw = 1 - w
  const keys = Object.keys(primary) as ImageContentCategory[]
  const out = { ...primary }
  for (const k of keys) {
    out[k] = w * primary[k] + iw * secondary[k]
  }
  const sum = keys.reduce((s, k) => s + out[k], 0)
  if (sum > 1e-12) {
    for (const k of keys) out[k] /= sum
  }
  return out
}
