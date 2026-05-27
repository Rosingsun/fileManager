import type { ClassificationModelId } from '../utils/classificationModels'
import { getClassificationModelPath, getModelsDir } from '../utils/classificationModels'
import { preprocessLetterbox, preprocessMultiCrop } from '../utils/classificationPreprocess'
import {
  getClipSession,
  encodeClipImagePixels,
  loadPromptsFile,
  averageClipEmbeddings,
  type ClipPromptsFile
} from '../utils/clipClassifier'
import type { ClipScoringConfig } from './calibration'
import type { NineProbabilities } from './types'
import { EMPTY_NINE } from './types'
import type { ImageContentCategory } from '../../../src/types'

function l2NormalizeArray(a: Float32Array): Float32Array {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * a[i]
  const inv = 1 / Math.sqrt(s + 1e-12)
  const o = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) o[i] = a[i] * inv
  return o
}

function dotNormalized(a: Float32Array, b: number[]): number {
  const te = new Float32Array(b.length)
  for (let i = 0; i < b.length; i++) te[i] = b[i]
  const tnorm = l2NormalizeArray(te)
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * tnorm[i]
  return dot
}

function maxMeanCos(
  imageEmb: Float32Array,
  embeddings: number[][],
  maxWeight: number,
  meanWeight: number
): number {
  let maxCos = -1
  let sumCos = 0
  let count = 0
  for (const emb of embeddings) {
    const dot = dotNormalized(imageEmb, emb)
    sumCos += dot
    count += 1
    if (dot > maxCos) maxCos = dot
  }
  const meanCos = count > 0 ? sumCos / count : 0
  return maxCos >= 0 ? maxWeight * maxCos + meanWeight * meanCos : meanCos
}

function softmaxTemperature(logits: number[], t: number): number[] {
  const scaled = logits.map(l => l / t)
  let max = -Infinity
  for (const x of scaled) if (x > max) max = x
  const exps = scaled.map(x => Math.exp(x - max))
  const s = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / s)
}

export function scoreClipWithConfig(
  imageEmb: Float32Array,
  prompts: ClipPromptsFile,
  scoring: ClipScoringConfig
): NineProbabilities {
  const out: NineProbabilities = { ...EMPTY_NINE }
  const logits: number[] = []
  const catKeys: ImageContentCategory[] = []

  for (const block of prompts.categories) {
    logits.push(
      maxMeanCos(imageEmb, block.embeddings, scoring.maxWeight, scoring.meanWeight)
    )
    catKeys.push(block.category)
  }

  const probs = softmaxTemperature(logits, scoring.temperature)
  for (let i = 0; i < catKeys.length; i++) {
    out[catKeys[i]] = probs[i] ?? 0
  }
  return out
}

export interface ClipInferenceResult {
  clipNine: NineProbabilities
  imageEmb: Float32Array
  prompts: ClipPromptsFile
}

export async function runClipInference(
  imagePath: string,
  cwd: string,
  clipModelId: ClassificationModelId,
  promptsFile: string,
  ttaCropCount: number,
  scoring: ClipScoringConfig
): Promise<ClipInferenceResult | null> {
  const modelsDir = getModelsDir(cwd)
  const prompts = loadPromptsFile(modelsDir, promptsFile)
  const clipPath = getClassificationModelPath(clipModelId, cwd)
  const clipSession = await getClipSession(clipPath)

  if (!clipSession || !prompts) return null

  const clipSize = 224
  const cropPixels =
    ttaCropCount > 1
      ? await preprocessMultiCrop(imagePath, clipSize, 'clip', ttaCropCount)
      : [await preprocessLetterbox(imagePath, clipSize, 'clip')]

  const embeddings: Float32Array[] = []
  for (const pixels of cropPixels) {
    const emb = await encodeClipImagePixels(clipSession, pixels, clipSize)
    if (emb) embeddings.push(emb)
  }

  const imageEmb = averageClipEmbeddings(embeddings)
  if (!imageEmb) return null

  const clipNine = scoreClipWithConfig(imageEmb, prompts, scoring)
  return { clipNine, imageEmb, prompts }
}
