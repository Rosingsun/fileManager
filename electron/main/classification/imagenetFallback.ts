import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { InferenceSession, Tensor } from 'onnxruntime-node'
import type { ImageContentCategory } from '../../../src/types'
import {
  CLASSIFICATION_MODELS,
  type ClassificationModelId,
  getClassificationModelPath
} from '../utils/classificationModels'
import { preprocessLetterbox, preprocessMultiCrop } from '../utils/classificationPreprocess'
import { softmax } from '../utils/imagenetNine'
import type { NineProbabilities } from './types'
import { EMPTY_NINE } from './types'

let imagenetLabelsCache: string[] | null = null
const imagenetSessions = new Map<ClassificationModelId, InferenceSession | null>()
let imagenetLoading = false

/** ImageNet 千类中 index 0–397 为动植物等（仅用于标签级映射，不再整段默认动物） */
const IMAGENET_ORGANISM_MAX_INDEX = 397

const PERSON_CUE =
  /\b(academic gown|baseball player|bikini|bow tie|bridegroom|cowboy|crash helmet|diaper|football helmet|gas mask|gown|kimono|lab coat|military|miniskirt|neck brace|oxygen mask|poncho|scuba diver|seat belt|ski mask|sombrero|sunglasses|swimming cap|wig|graduation|priest|sailor|shepherd|groom|nun|referee|ballplayer|matador)\b/i

const LANDSCAPE_ORGANISM =
  /\b(brain coral|stony coral|sea anemone|coral fungus|mushroom|jellyfish|sea slug|sea urchin|starfish|conch|chiton|chambered nautilus|dungeness crab|rock crab|king crab|American lobster|spiny lobster|coral reef)\b/i

export function loadImagenetLabels(cwd: string): string[] {
  if (imagenetLabelsCache && imagenetLabelsCache.length === 1000) {
    return imagenetLabelsCache
  }
  const p = join(cwd, 'models', 'imagenet1000.json')
  if (!existsSync(p)) {
    throw new Error(`缺少 ImageNet 标签文件: ${p}`)
  }
  const arr = JSON.parse(readFileSync(p, 'utf-8')) as string[]
  if (!Array.isArray(arr) || arr.length !== 1000) {
    throw new Error(`ImageNet 标签数量应为 1000，当前 ${arr?.length}`)
  }
  imagenetLabelsCache = arr
  return arr
}

export function clearImagenetSessionCache(modelId?: ClassificationModelId): void {
  if (modelId) imagenetSessions.delete(modelId)
  else imagenetSessions.clear()
}

async function getImagenetSession(
  cwd: string,
  modelId: ClassificationModelId
): Promise<InferenceSession | null> {
  const cached = imagenetSessions.get(modelId)
  if (cached) return cached

  if (imagenetLoading) {
    while (imagenetLoading) await new Promise(r => setTimeout(r, 50))
    return imagenetSessions.get(modelId) || null
  }

  const path = getClassificationModelPath(modelId, cwd)
  if (!existsSync(path)) {
    console.warn('[分类] ImageNet 模型不存在:', path)
    return null
  }

  try {
    imagenetLoading = true
    const session = await InferenceSession.create(path, { executionProviders: ['cpu'] })
    imagenetSessions.set(modelId, session)
    return session
  } catch (e) {
    console.error('[分类] ImageNet 加载失败', e)
    imagenetSessions.set(modelId, null)
    return null
  } finally {
    imagenetLoading = false
  }
}

function imagenetLabelToNine(label: string): ImageContentCategory {
  const l = label.toLowerCase()

  if (/^(baseball player|bridegroom|scuba diver)$/.test(l) || PERSON_CUE.test(l)) return 'person'

  if (
    /\b(web site|website|menu|crossword|comic book|notebook|monitor|screen|desktop computer|hand-held computer|cellular telephone|remote control|typewriter keyboard|printer|keyboard|mouse|iPod|modem|oscilloscope)\b/.test(
      l
    )
  ) {
    return 'document'
  }

  if (
    /\b(car|jeep|minivan|limousine|sports car|convertible|cab|police van|ambulance|fire engine|garbage truck|tow truck|tractor|bus|trolleybus|streetcar|locomotive|bullet train|bicycle|unicycle|ship|lifeboat|speedboat|canoe|airliner|warplane|space shuttle|missile|rocket)\b/.test(
      l
    )
  ) {
    return 'vehicle'
  }

  if (
    /\b(plate|consomme|hot pot|trifle|ice cream|baguette|bagel|pretzel|cheeseburger|hot dog|pizza|burrito|red wine|espresso|cup|eggnog|guacamole|wine bottle|beer bottle|coffee mug)\b/.test(
      l
    )
  ) {
    return 'food'
  }

  if (
    /\b(alp|cliff|coral reef|geyser|lakeshore|promontory|sandbar|seashore|valley|volcano|rapeseed|hay)\b/.test(l)
  ) {
    return 'landscape'
  }

  if (
    /\b(library|restaurant|cinema|bookstore|palace|monastery|church|mosque|castle|viaduct|dam|lighthouse|stadium|arena|street sign|traffic light|parking meter|fountain)\b/.test(
      l
    )
  ) {
    return 'urban'
  }

  if (
    /\b(bathtub|shower curtain|microwave|oven|refrigerator|dishwasher|washer|toilet seat|cradle|crib|fireplace|studio couch|bookcase|wardrobe|dining table|desk|table lamp)\b/.test(
      l
    )
  ) {
    return 'indoor'
  }

  return 'other'
}

function categoryForTopK(index: number, label: string): ImageContentCategory {
  if (index >= 0 && index <= IMAGENET_ORGANISM_MAX_INDEX) {
    if (LANDSCAPE_ORGANISM.test(label)) return 'landscape'
    if (PERSON_CUE.test(label)) return 'person'
    return 'animal'
  }
  return imagenetLabelToNine(label)
}

/** 仅从 Top-K ImageNet 预测聚合到 9 类（避免全量 0–397 默认动物） */
export function aggregateImagenetTopKToNine(
  probs: Float32Array,
  labels: string[],
  topK = 25
): NineProbabilities {
  const out: NineProbabilities = { ...EMPTY_NINE }
  const n = Math.min(probs.length, labels.length)
  const ranked = Array.from({ length: n }, (_, i) => ({ i, p: probs[i] }))
    .sort((a, b) => b.p - a.p)
    .slice(0, topK)

  for (const { i, p } of ranked) {
    const cat = categoryForTopK(i, labels[i])
    out[cat] += p
  }

  const sum = Object.values(out).reduce((s, v) => s + v, 0)
  if (sum > 1e-12) {
    for (const k of Object.keys(out) as ImageContentCategory[]) {
      out[k] /= sum
    }
  }
  return out
}

export async function runImagenetFallback(
  imagePath: string,
  cwd: string,
  modelId: ClassificationModelId,
  labels: string[],
  ttaCropCount: number
): Promise<NineProbabilities | null> {
  const branchInfo = CLASSIFICATION_MODELS.find(m => m.id === modelId)
  const inputSize = branchInfo?.inputSize || 224
  const session = await getImagenetSession(cwd, modelId)
  if (!session) return null

  const cropPixels =
    ttaCropCount > 1
      ? await preprocessMultiCrop(imagePath, inputSize, 'imagenet', ttaCropCount)
      : [await preprocessLetterbox(imagePath, inputSize, 'imagenet')]

  const inName = session.inputNames[0] || 'input'
  const outName = session.outputNames[0] || 'output'
  const n = labels.length
  const avgLogits = new Float32Array(n)

  for (const pixels of cropPixels) {
    const inputTensor = new Tensor('float32', pixels, [1, 3, inputSize, inputSize])
    const outputs = await session.run({ [inName]: inputTensor })
    const logits = (outputs[outName] as Tensor).data as Float32Array
    const len = Math.min(logits.length, n)
    for (let i = 0; i < len; i++) avgLogits[i] += logits[i]
  }

  for (let i = 0; i < n; i++) avgLogits[i] /= cropPixels.length
  const probs = softmax(avgLogits)
  return aggregateImagenetTopKToNine(probs, labels)
}
