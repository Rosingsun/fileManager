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

export interface ClipPromptsFile {
  modelId: string
  dim: number
  categories: Array<{
    category: ImageContentCategory
    prompts: string[]
    embeddings: number[][]
  }>
}

let cachedPrompts: ClipPromptsFile | null = null
let cachedSession: InferenceSession | null = null
let cachedModelPath: string | null = null

function l2NormalizeArray(a: Float32Array): Float32Array {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * a[i]
  const inv = 1 / Math.sqrt(s + 1e-12)
  const o = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) o[i] = a[i] * inv
  return o
}

function loadPromptsFile(modelsDir: string): ClipPromptsFile | null {
  if (cachedPrompts) return cachedPrompts
  const p = join(modelsDir, 'clip-prompts.json')
  if (!existsSync(p)) {
    console.warn('[CLIP] 未找到', p, '，将仅使用 ImageNet 聚合。可运行 scripts/_clip_text_gen/generate-prompts.mjs 生成。')
    return null
  }
  try {
    const raw = readFileSync(p, 'utf-8')
    const j = JSON.parse(raw) as ClipPromptsFile
    if (!j.categories?.length) return null
    cachedPrompts = j
    return j
  } catch (e) {
    console.warn('[CLIP] 读取 clip-prompts.json 失败', e)
    return null
  }
}

export function clearClipModelCache(): void {
  cachedSession = null
  cachedModelPath = null
  cachedPrompts = null
}

export async function getClipSession(modelPath: string): Promise<InferenceSession | null> {
  if (cachedSession && cachedModelPath === modelPath) return cachedSession
  if (!existsSync(modelPath)) return null
  try {
    const session = await InferenceSession.create(modelPath, { executionProviders: ['cpu'] })
    cachedSession = session
    cachedModelPath = modelPath
    console.log('[CLIP] 视觉模型已加载', modelPath, 'inputs:', session.inputNames, 'outputs:', session.outputNames)
    return session
  } catch (e) {
    console.error('[CLIP] 加载视觉模型失败', e)
    return null
  }
}

/**
 * 将 CLIP 预处理的 NCHW float32 张量（已归一化）送入视觉编码器，返回 L2 归一化图像向量
 */
export async function encodeClipImagePixels(
  session: InferenceSession,
  pixelsNCHW: Float32Array,
  inputSize: number
): Promise<Float32Array | null> {
  const inputName = session.inputNames[0] || 'pixel_values'
  const tensor = new Tensor('float32', pixelsNCHW, [1, 3, inputSize, inputSize])
  const feeds: Record<string, Tensor> = {}
  feeds[inputName] = tensor
  const results = await session.run(feeds)
  const outName =
    session.outputNames.find(n => /embed|pooler|image/i.test(n)) || session.outputNames[0]
  const output = results[outName] as Tensor
  if (!output?.data) return null
  const data = output.data as Float32Array
  return l2NormalizeArray(new Float32Array(data))
}

/** logits -> softmax with temperature */
function softmaxTemperature(logits: number[], t = 0.01): number[] {
  const scaled = logits.map(l => l / t)
  let max = -Infinity
  for (const x of scaled) if (x > max) max = x
  const exps = scaled.map(x => Math.exp(x - max))
  const s = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / s)
}

/**
 * 对每类多条 prompt 嵌入取平均并 L2 归一化，再与图像向量点积得 logits
 */
export function scoreClipZeroShot(
  imageEmb: Float32Array,
  prompts: ClipPromptsFile
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
    let sumCos = 0
    let count = 0
    for (const emb of block.embeddings) {
      const te = new Float32Array(emb.length)
      for (let i = 0; i < emb.length; i++) te[i] = emb[i]
      const tnorm = l2NormalizeArray(te)
      let dot = 0
      for (let i = 0; i < imageEmb.length; i++) dot += imageEmb[i] * tnorm[i]
      sumCos += dot
      count += 1
    }
    const logit = count > 0 ? sumCos / count : 0
    logits.push(logit)
    catKeys.push(block.category)
  }

  const probs = softmaxTemperature(logits, 0.05)
  for (let i = 0; i < catKeys.length; i++) {
    out[catKeys[i]] = probs[i] ?? 0
  }

  return out
}

export function isClipAvailable(modelsDir: string, visionOnnxName: string): boolean {
  const v = join(modelsDir, visionOnnxName)
  const p = join(modelsDir, 'clip-prompts.json')
  return existsSync(v) && existsSync(p) && (loadPromptsFile(modelsDir) !== null)
}

export { CLIP_MEAN, CLIP_STD, CATEGORIES, loadPromptsFile }
