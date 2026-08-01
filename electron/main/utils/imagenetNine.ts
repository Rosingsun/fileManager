import type { ImageContentCategory } from '../../../src/types'

export type { NineProbabilities } from '../classification/types'
export { EMPTY_NINE } from '../classification/types'

export function softmax(logits: Float32Array): Float32Array {
  let max = -Infinity
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > max) max = logits[i]
  }
  const out = new Float32Array(logits.length)
  let sum = 0
  for (let i = 0; i < logits.length; i++) {
    const v = Math.exp(logits[i] - max)
    out[i] = v
    sum += v
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum
  return out
}

/** @deprecated 仅 cognivision 遗留路径使用 */
export const IMAGENET_ORGANISM_MAX_INDEX = 397

const PERSON_IMAGENET_CUE =
  /\b(academic gown|baseball player|bikini|bow tie|bridegroom|cowboy|scuba diver)\b/i

const LANDSCAPE_ORGANISM_LABEL =
  /\b(brain coral|stony coral|sea anemone|coral fungus|mushroom|jellyfish)\b/i

/** @deprecated cognivision 遗留 */
export function imagenetLabelToNine(label: string): ImageContentCategory {
  const l = label.toLowerCase()
  if (PERSON_IMAGENET_CUE.test(l)) return 'person'
  if (LANDSCAPE_ORGANISM_LABEL.test(l)) return 'landscape'
  if (/\b(car|jeep|bus|bicycle|airliner|ship)\b/.test(l)) return 'vehicle'
  if (/\b(plate|pizza|espresso|cheeseburger)\b/.test(l)) return 'food'
  if (/\b(alp|cliff|valley|volcano)\b/.test(l)) return 'landscape'
  if (/\b(church|library|stadium|street sign)\b/.test(l)) return 'urban'
  if (/\b(refrigerator|bathtub|desk|bookcase)\b/.test(l)) return 'indoor'
  if (/\b(monitor|screen|keyboard)\b/.test(l)) return 'document'
  return 'other'
}

/** @deprecated cognivision 遗留 */
export function categoryForImagenetIndex(index: number, label: string): ImageContentCategory {
  if (index >= 0 && index <= IMAGENET_ORGANISM_MAX_INDEX) {
    if (LANDSCAPE_ORGANISM_LABEL.test(label)) return 'landscape'
    return 'animal'
  }
  return imagenetLabelToNine(label)
}

/** @deprecated cognivision 遗留 */
export function aggregateImagenetToNine(
  probs: Float32Array,
  labels: string[]
): import('../classification/types').NineProbabilities {
  const out: import('../classification/types').NineProbabilities = {
    person: 0,
    animal: 0,
    landscape: 0,
    urban: 0,
    indoor: 0,
    food: 0,
    vehicle: 0,
    document: 0,
    other: 0
  }
  const n = Math.min(probs.length, labels.length)
  for (let i = 0; i < n; i++) {
    const cat = categoryForImagenetIndex(i, labels[i])
    out[cat] += probs[i]
  }
  return out
}

/** @deprecated cognivision 遗留 */
export function argmaxNine(
  nine: import('../classification/types').NineProbabilities
): { category: ImageContentCategory; confidence: number } {
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
