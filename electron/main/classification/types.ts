import type { ImageContentCategory } from '../../../src/types'

export type NineProbabilities = Record<ImageContentCategory, number>

export const EMPTY_NINE: NineProbabilities = {
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

export type ClassificationStatus = 'ok' | 'uncertain' | 'failed'
