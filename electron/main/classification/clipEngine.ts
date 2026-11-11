import type { ImageContentCategory } from '../../../src/types'
import type { ClassificationModelId } from '../utils/classificationModels'
import { getClassificationModelPath, getModelsDir } from '../utils/classificationModels'
import { preprocessImage, preprocessMultiCrop } from '../utils/classificationPreprocess'
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
  for (let i = 0; i < a.length && i < tnorm.length; i++) dot += a[i] * tnorm[i]
  return dot
}

function softmaxTemperature(logits: number[], t: number): number[] {
  const scaled = logits.map(l => l / Math.max(1e-4, t))
  let max = -Infinity
  for (const x of scaled) if (x > max) max = x
  const exps = scaled.map(x => Math.exp(Math.max(-60, x - max)))
  const s = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / s)
}

/**
 * 零样本打分：
 *   类别原型 = 该类所有 prompt 文本嵌入的均值再 L2 归一化（标准 prompt ensembling）
 *   logit    = (1-maxBlend)*原型余弦 + maxBlend*最相似 prompt 余弦 + 标定偏置
 *   prob     = softmax(logit / temperature)
 *
 * 与 calibrate-classification.mjs 的公式严格一致，保证离线标定结果能直接作用于运行时。
 */
export function scoreClipWithConfig(
  imageEmb: Float32Array,
  prompts: ClipPromptsFile,
  scoring: ClipScoringConfig
): NineProbabilities {
  const out: NineProbabilities = { ...EMPTY_NINE }
  const logits: number[] = []
  const catKeys: ImageContentCategory[] = []

  for (const block of prompts.categories) {
    const embs = block.embeddings || []
    if (!embs.length) continue
    const dim = imageEmb.length
    const sum = new Float32Array(dim)
    let maxCos = -Infinity

    for (const raw of embs) {
      const norm = l2NormalizeArray(Float32Array.from(raw))
      for (let i = 0; i < dim && i < norm.length; i++) sum[i] += norm[i]
      const cos = dotNormalized(imageEmb, raw)
      if (cos > maxCos) maxCos = cos
    }
    for (let i = 0; i < dim; i++) sum[i] /= embs.length
    const protoCos = (() => {
      let d = 0
      const proto = l2NormalizeArray(sum)
      for (let i = 0; i < dim; i++) d += imageEmb[i] * proto[i]
      return d
    })()

    const blend = Math.min(1, Math.max(0, scoring.maxBlend ?? 0))
    const bias = scoring.classBias?.[block.category] ?? 0
    logits.push((1 - blend) * protoCos + blend * maxCos + bias)
    catKeys.push(block.category)
  }

  if (!logits.length) return out
  const probs = softmaxTemperature(logits, scoring.temperature)
  for (let i = 0; i < catKeys.length; i++) out[catKeys[i]] = probs[i] ?? 0
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
      : [await preprocessImage(imagePath, clipSize, 'clip')]

  const embeddings: Float32Array[] = []
  for (const pixels of cropPixels) {
    const emb = await encodeClipImagePixels(clipSession, pixels, clipSize)
    if (emb) embeddings.push(emb)
  }

  const imageEmb = averageClipEmbeddings(embeddings)
  if (!imageEmb) return null
  if (imageEmb.length !== prompts.dim) {
    console.error(
      `[CLIP] 视觉模型输出 ${imageEmb.length} 维，但 ${promptsFile} 为 ${prompts.dim} 维；` +
      '模型与文本嵌入不匹配，已拒绝推理。请检查预设配置或重新生成 prompts。'
    )
    return null
  }

  const clipNine = scoreClipWithConfig(imageEmb, prompts, scoring)
  return { clipNine, imageEmb, prompts }
}
