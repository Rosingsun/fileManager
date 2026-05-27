import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { InferenceSession, Tensor } from 'onnxruntime-node'
import type { ImageContentCategory } from '../../../src/types'
import type { NineProbabilities } from './imagenetNine'

const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073]
const CLIP_STD = [0.26862954, 0.26130258, 0.27577711]

const CATEGORIES: ImageContentCategory[] = [
  'person',
  'animal',
  'landscape',
  'urban',
  'indoor',
  'food',
  'vehicle',
  'document',
  'other'
]

export interface ClipDisambiguationBlock {
  pairKey: string
  categoryA: ImageContentCategory
  categoryB: ImageContentCategory
  promptsA: string[]
  promptsB: string[]
  embeddingsA: number[][]
  embeddingsB: number[][]
}

export interface ClipPromptsFile {
  modelId: string
  dim: number
  categories: Array<{
    category: ImageContentCategory
    prompts: string[]
    embeddings: number[][]
  }>
  disambiguation?: ClipDisambiguationBlock[]
}

const promptsCache = new Map<string, ClipPromptsFile>()
const clipSessions = new Map<string, InferenceSession | null>()

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

function maxMeanCos(imageEmb: Float32Array, embeddings: number[][]): number {
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
  return maxCos >= 0 ? 0.62 * maxCos + 0.38 * meanCos : meanCos
}

function loadPromptsFile(modelsDir: string, fileName = 'clip-prompts.json'): ClipPromptsFile | null {
  const cacheKey = join(modelsDir, fileName)
  const cached = promptsCache.get(cacheKey)
  if (cached) return cached

  const p = join(modelsDir, fileName)
  if (!existsSync(p)) {
    console.warn('[CLIP] 未找到', p)
    return null
  }
  try {
    const raw = readFileSync(p, 'utf-8')
    const j = JSON.parse(raw) as ClipPromptsFile
    if (!j.categories?.length) return null
    promptsCache.set(cacheKey, j)
    return j
  } catch (e) {
    console.warn('[CLIP] 读取 prompts 失败', e)
    return null
  }
}

export function clearClipModelCache(): void {
  clipSessions.clear()
  promptsCache.clear()
}

export async function getClipSession(modelPath: string): Promise<InferenceSession | null> {
  const cached = clipSessions.get(modelPath)
  if (cached !== undefined) return cached
  if (!existsSync(modelPath)) return null
  try {
    const session = await InferenceSession.create(modelPath, { executionProviders: ['cpu'] })
    clipSessions.set(modelPath, session)
    console.log('[CLIP] 视觉模型已加载', modelPath)
    return session
  } catch (e) {
    console.error('[CLIP] 加载视觉模型失败', e)
    clipSessions.set(modelPath, null)
    return null
  }
}

export async function encodeClipImagePixels(
  session: InferenceSession,
  pixelsNCHW: Float32Array,
  inputSize: number
): Promise<Float32Array | null> {
  const inputName = session.inputNames[0] || 'pixel_values'
  const tensor = new Tensor('float32', pixelsNCHW, [1, 3, inputSize, inputSize])
  const feeds: Record<string, Tensor> = { [inputName]: tensor }
  const results = await session.run(feeds)
  const outName =
    session.outputNames.find(n => /embed|pooler|image/i.test(n)) || session.outputNames[0]
  const output = results[outName] as Tensor
  if (!output?.data) return null
  const data = output.data as Float32Array
  return l2NormalizeArray(new Float32Array(data))
}

/** 多裁剪 embedding：L2 归一化后取平均，再 L2 归一化 */
export function averageClipEmbeddings(embeddings: Float32Array[]): Float32Array | null {
  if (!embeddings.length) return null
  if (embeddings.length === 1) return embeddings[0]

  const dim = embeddings[0].length
  const sum = new Float32Array(dim)
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) sum[i] += emb[i]
  }
  for (let i = 0; i < dim; i++) sum[i] /= embeddings.length
  return l2NormalizeArray(sum)
}

function softmaxTemperature(logits: number[], t = 0.01): number[] {
  const scaled = logits.map(l => l / t)
  let max = -Infinity
  for (const x of scaled) if (x > max) max = x
  const exps = scaled.map(x => Math.exp(x - max))
  const s = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / s)
}

export function scoreClipZeroShot(
  imageEmb: Float32Array,
  prompts: ClipPromptsFile,
  temperature = 0.058
): NineProbabilities {
  const out: NineProbabilities = {
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

  const logits: number[] = []
  const catKeys: ImageContentCategory[] = []

  for (const block of prompts.categories) {
    logits.push(maxMeanCos(imageEmb, block.embeddings))
    catKeys.push(block.category)
  }

  const probs = softmaxTemperature(logits, temperature)
  for (let i = 0; i < catKeys.length; i++) {
    out[catKeys[i]] = probs[i] ?? 0
  }

  return out
}

export function scorePairwiseDisambiguation(
  imageEmb: Float32Array,
  block: ClipDisambiguationBlock
): { scoreA: number; scoreB: number } {
  return {
    scoreA: maxMeanCos(imageEmb, block.embeddingsA),
    scoreB: maxMeanCos(imageEmb, block.embeddingsB)
  }
}

export function isClipAvailable(
  modelsDir: string,
  visionOnnxName: string,
  promptsFile = 'clip-prompts.json'
): boolean {
  const v = join(modelsDir, visionOnnxName)
  const p = join(modelsDir, promptsFile)
  return existsSync(v) && existsSync(p) && loadPromptsFile(modelsDir, promptsFile) !== null
}

export { CLIP_MEAN, CLIP_STD, CATEGORIES, loadPromptsFile }
