import { existsSync } from 'fs'
import { readFileSync } from 'fs'
import { join } from 'path'
import { InferenceSession, Tensor } from 'onnxruntime-node'
import type { ImageClassificationResult } from '../../../src/types'
import {
  CLASSIFICATION_MODELS,
  type ClassificationModelId,
  getClassificationModelPath,
  getModelsDir
} from '../utils/classificationModels'
import { preprocessLetterbox } from '../utils/classificationPreprocess'
import {
  softmax,
  aggregateImagenetToNine,
  fuseClipAndImagenetAdaptive,
  rebalancePersonAnimalFromTopPredictions,
  disambiguatePersonAnimalWithClip,
  argmaxNine,
  nineProbabilitiesToTopPredictions
} from '../utils/imagenetNine'
import {
  getClipSession,
  encodeClipImagePixels,
  scoreClipZeroShot,
  loadPromptsFile
} from '../utils/clipClassifier'
import { classifyWithCognivisionTf } from './cognivisionTfClassifier'

let imagenetLabelsCache: string[] | null = null

function loadImagenetLabels(cwd: string): string[] {
  if (imagenetLabelsCache && imagenetLabelsCache.length === 1000) {
    return imagenetLabelsCache
  }
  const p = join(cwd, 'models', 'imagenet1000.json')
  if (!existsSync(p)) {
    throw new Error(`缺少 ImageNet 标签文件: ${p}（仓库应包含 models/imagenet1000.json）`)
  }
  const raw = readFileSync(p, 'utf-8')
  const arr = JSON.parse(raw) as string[]
  if (!Array.isArray(arr) || arr.length !== 1000) {
    throw new Error(`ImageNet 标签数量应为 1000，当前 ${arr?.length}`)
  }
  imagenetLabelsCache = arr
  return arr
}

const imagenetSessions = new Map<ClassificationModelId, InferenceSession | null>()
let imagenetLoading = false

async function getImagenetSession(
  cwd: string,
  modelId: ClassificationModelId
): Promise<InferenceSession | null> {
  if (modelId === 'clip_vit_b32_quant') return null
  const cached = imagenetSessions.get(modelId)
  if (cached) return cached

  if (imagenetLoading) {
    while (imagenetLoading) {
      await new Promise(r => setTimeout(r, 50))
    }
    return imagenetSessions.get(modelId) || null
  }

  const path = getClassificationModelPath(cwd, modelId)
  if (!existsSync(path)) {
    console.warn('[分类] ImageNet 模型不存在:', path)
    return null
  }

  try {
    imagenetLoading = true
    const session = await InferenceSession.create(path, { executionProviders: ['cpu'] })
    imagenetSessions.set(modelId, session)
    console.log('[分类] ImageNet 模型已加载', modelId, session.inputNames, session.outputNames)
    return session
  } catch (e) {
    console.error('[分类] ImageNet 加载失败', e)
    imagenetSessions.set(modelId, null)
    return null
  } finally {
    imagenetLoading = false
  }
}

export function clearImagenetSessionCache(modelId?: ClassificationModelId): void {
  if (modelId) {
    imagenetSessions.delete(modelId)
  } else {
    imagenetSessions.clear()
  }
}

function imagenetBranchModelId(selected: ClassificationModelId): ClassificationModelId {
  if (selected === 'clip_vit_b32_quant') return 'mobilenetv2'
  return selected
}

export async function classifyImage(
  imagePath: string,
  cwd: string,
  modelId: ClassificationModelId = 'clip_vit_b32_quant'
): Promise<ImageClassificationResult> {
  if (modelId === 'cognivision') {
    return classifyWithCognivisionTf(imagePath, cwd)
  }

  const fileName = imagePath.split(/[/\\]/).pop() || imagePath
  const labels = loadImagenetLabels(cwd)
  const branchId = imagenetBranchModelId(modelId)

  const branchInfo = CLASSIFICATION_MODELS.find(m => m.id === branchId)
  const inputSize = branchInfo?.inputSize || 224

  try {
    const imagenetModel = await getImagenetSession(cwd, branchId)
    if (!imagenetModel) {
      throw new Error(`ImageNet 模型未加载（请先下载 ${branchId}）`)
    }

    const imagenetPixels = await preprocessLetterbox(imagePath, inputSize, 'imagenet')
    const inName = imagenetModel.inputNames[0] || 'input'
    const inputTensor = new Tensor('float32', imagenetPixels, [1, 3, inputSize, inputSize])
    const feeds: Record<string, Tensor> = { [inName]: inputTensor }
    const outputs = await imagenetModel.run(feeds)
    const outName = imagenetModel.outputNames[0] || 'output'
    const outputTensor = outputs[outName] as Tensor
    const logits = outputTensor.data as Float32Array
    const n = Math.min(logits.length, labels.length)
    const probs = softmax(logits.slice(0, n))

    if (logits.length !== labels.length) {
      console.warn(`[分类] 输出维度 ${logits.length} 与标签 ${labels.length} 不一致，已截断聚合`)
    }

    let imagenetNine = aggregateImagenetToNine(probs, labels.slice(0, n))
    imagenetNine = rebalancePersonAnimalFromTopPredictions(probs, labels.slice(0, n), imagenetNine)

    let finalNine = { ...imagenetNine }
    const modelsDir = getModelsDir(cwd)

    if (modelId === 'clip_vit_b32_quant') {
      const prompts = loadPromptsFile(modelsDir)
      const clipPath = getClassificationModelPath(cwd, 'clip_vit_b32_quant')
      const clipSession = await getClipSession(clipPath)

      if (clipSession && prompts) {
        const clipSize = 224
        const clipPixels = await preprocessLetterbox(imagePath, clipSize, 'clip')
        const emb = await encodeClipImagePixels(clipSession, clipPixels, clipSize)
        if (emb) {
          const clipNine = scoreClipZeroShot(emb, prompts)
          finalNine = fuseClipAndImagenetAdaptive(clipNine, imagenetNine)
          finalNine = disambiguatePersonAnimalWithClip(finalNine, clipNine)
          const sorted = (Object.entries(finalNine) as [keyof typeof finalNine, number][])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
          console.log(
            `[CLIP] top3 ${fileName}:`,
            sorted.map(([k, v]) => `${k}=${(v * 100).toFixed(1)}%`).join(', ')
          )
        } else {
          console.warn('[CLIP] 图像向量为空，使用 ImageNet 聚合')
        }
      } else {
        console.warn('[CLIP] 未启用（缺少 vision ONNX 或 clip-prompts.json），使用 ImageNet 聚合')
      }
    }

    const best = argmaxNine(finalNine)
    const topPredictions = nineProbabilitiesToTopPredictions(finalNine, 3, 0.05, 0.02)

    return {
      filePath: imagePath,
      category: best.category,
      confidence: best.confidence,
      topPredictions
    }
  } catch (error) {
    console.error(`[分类] 失败 (${fileName}):`, error)
    return {
      filePath: imagePath,
      category: 'other',
      confidence: 0
    }
  }
}
