import type { ImageContentCategory } from '../../../src/types'
import type { NineProbabilities } from './imagenetNine'
import type { ClipPromptsFile } from './clipClassifier'
import { scorePairwiseDisambiguation } from './clipClassifier'

export interface DisambiguationTrigger {
  pairKey: string
  categoryA: ImageContentCategory
  categoryB: ImageContentCategory
  /** 两类别概率差小于此值时触发 */
  maxProbDiff: number
  /** 可选：至少一个类别需达到的最小概率 */
  minEitherProb?: number
  /** 可选：categoryA 需落在此区间（document_other 用） */
  categoryAProbRange?: [number, number]
}

export const DEFAULT_DISAMBIGUATION_TRIGGERS: DisambiguationTrigger[] = [
  { pairKey: 'person_animal', categoryA: 'person', categoryB: 'animal', maxProbDiff: 0.12, minEitherProb: 0.08 },
  { pairKey: 'indoor_urban', categoryA: 'indoor', categoryB: 'urban', maxProbDiff: 0.10, minEitherProb: 0.08 },
  { pairKey: 'landscape_urban', categoryA: 'landscape', categoryB: 'urban', maxProbDiff: 0.10, minEitherProb: 0.08 },
  { pairKey: 'food_indoor', categoryA: 'food', categoryB: 'indoor', maxProbDiff: 0.08, minEitherProb: 0.06 },
  {
    pairKey: 'document_other',
    categoryA: 'document',
    categoryB: 'other',
    maxProbDiff: 0.20,
    categoryAProbRange: [0.15, 0.35]
  }
]

function renormNine(nine: NineProbabilities): NineProbabilities {
  const keys = Object.keys(nine) as ImageContentCategory[]
  const sum = keys.reduce((s, k) => s + nine[k], 0)
  if (sum <= 1e-12) return { ...nine }
  const out = { ...nine }
  for (const k of keys) out[k] /= sum
  return out
}

function shouldTrigger(trigger: DisambiguationTrigger, nine: NineProbabilities): boolean {
  const pa = nine[trigger.categoryA]
  const pb = nine[trigger.categoryB]
  const diff = Math.abs(pa - pb)

  if (trigger.categoryAProbRange) {
    const [lo, hi] = trigger.categoryAProbRange
    if (pa < lo || pa > hi) return false
    return diff <= trigger.maxProbDiff || pb > pa
  }

  if (trigger.minEitherProb !== undefined && pa < trigger.minEitherProb && pb < trigger.minEitherProb) {
    return false
  }

  const topTwo = (Object.entries(nine) as [ImageContentCategory, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k)

  const involvesPair =
    (topTwo.includes(trigger.categoryA) && topTwo.includes(trigger.categoryB)) ||
    diff <= trigger.maxProbDiff

  return involvesPair && diff <= trigger.maxProbDiff
}

/**
 * 对融合后的 9 类概率执行 CLIP 成对消歧，微调混淆类别概率。
 */
export function applyCategoryDisambiguation(
  merged: NineProbabilities,
  imageEmb: Float32Array,
  prompts: ClipPromptsFile,
  triggers: DisambiguationTrigger[] = DEFAULT_DISAMBIGUATION_TRIGGERS,
  shiftStrength = 0.22
): NineProbabilities {
  if (!prompts.disambiguation?.length) return merged

  let out = { ...merged }

  for (const trigger of triggers) {
    if (!shouldTrigger(trigger, out)) continue

    const block = prompts.disambiguation.find(d => d.pairKey === trigger.pairKey)
    if (!block) continue

    const { scoreA, scoreB } = scorePairwiseDisambiguation(imageEmb, block)
    const total = scoreA + scoreB
    if (total <= 1e-9) continue

    const winner = scoreA >= scoreB ? trigger.categoryA : trigger.categoryB
    const loser = winner === trigger.categoryA ? trigger.categoryB : trigger.categoryA
    const margin = Math.abs(scoreA - scoreB) / total
    if (margin < 0.04) continue

    const shift = Math.min(
      out[loser] * shiftStrength * (0.5 + margin),
      out[loser] * 0.35,
      0.18
    )
    if (shift <= 1e-6) continue

    out[loser] -= shift
    out[winner] += shift
    out = renormNine(out)
  }

  return out
}

export function applyConfidenceGate(
  nine: NineProbabilities,
  confMin = 0.28,
  marginMin = 0.06
): { nine: NineProbabilities; confidenceScale: number } {
  const entries = (Object.keys(nine) as ImageContentCategory[])
    .map(k => ({ category: k, confidence: nine[k] }))
    .sort((a, b) => b.confidence - a.confidence)

  const top = entries[0]
  const second = entries[1]
  const margin = top.confidence - (second?.confidence ?? 0)

  if (margin >= marginMin || top.confidence >= confMin) {
    return { nine, confidenceScale: 1 }
  }

  const scale = Math.max(0.55, 0.55 + margin / marginMin * 0.35)
  return { nine, confidenceScale: scale }
}
