import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { InferenceSession, Tensor } from 'onnxruntime-node'
import type { ImageClassificationResult } from '../../../src/types'
import {
  CLASSIFICATION_MODELS,
  type ClassificationModelId,
  getClassificationModelPath,
  getModelsDir
} from '../utils/classificationModels'
import { preprocessLetterbox, preprocessMultiCrop } from '../utils/classificationPreprocess'
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
  loadPromptsFile,
  averageClipEmbeddings
} from '../utils/clipClassifier'
import {
  getPresetById,
  legacyModelIdToPreset,
  type ClassificationPresetId
} from '../utils/classificationPresets'
import { applyCategoryDisambiguation, applyConfidenceGate } from '../utils/categoryDisambiguation'
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
  if (modelId === 'clip_vit_b32_quant' || modelId === 'clip_vit_l14_quant') return null
  const cached = imagenetSessions.get(modelId)
  if (cached) return cached

  if (imagenetLoading) {
    while (imagenetLoading) {
      await new Promise(r => setTimeout(r, 50))
    }
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
    console.log('[分类] ImageNet 模型已加载', modelId)
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

function resolvePresetId(presetOrModelId?: string): ClassificationPresetId {
  if (!presetOrModelId) return legacyModelIdToPreset()
  return legacyModelIdToPreset(presetOrModelId)
}

async function runImagenetBranch(
  imagePath: string,
  cwd: string,
  imagenetModelId: ClassificationModelId,
  labels: string[],
  ttaCropCount: number
): Promise<{ imagenetNine: ReturnType<typeof aggregateImagenetToNine>; probs: Float32Array }> {
  const branchInfo = CLASSIFICATION_MODELS.find(m => m.id === imagenetModelId)
  const inputSize = branchInfo?.inputSize || 224
  const imagenetModel = await getImagenetSession(cwd, imagenetModelId)
  if (!imagenetModel) {
    throw new Error(`ImageNet 模型未加载（请先下载 ${imagenetModelId}）`)
  }

  const cropPixels =
    ttaCropCount > 1
      ? await preprocessMultiCrop(imagePath, inputSize, 'imagenet', ttaCropCount)
      : [await preprocessLetterbox(imagePath, inputSize, 'imagenet')]

  const inName = imagenetModel.inputNames[0] || 'input'
  const outName = imagenetModel.outputNames[0] || 'output'
  const n = labels.length
  const avgLogits = new Float32Array(n)

  for (const pixels of cropPixels) {
    const inputTensor = new Tensor('float32', pixels, [1, 3, inputSize, inputSize])
    const outputs = await imagenetModel.run({ [inName]: inputTensor })
    const outputTensor = outputs[outName] as Tensor
    const logits = outputTensor.data as Float32Array
    const len = Math.min(logits.length, n)
    for (let i = 0; i < len; i++) avgLogits[i] += logits[i]
  }

  for (let i = 0; i < n; i++) avgLogits[i] /= cropPixels.length
  const probs = softmax(avgLogits)

  let imagenetNine = aggregateImagenetToNine(probs, labels)
  imagenetNine = rebalancePersonAnimalFromTopPredictions(probs, labels, imagenetNine)
  return { imagenetNine, probs }
}

async function runClipBranch(
  imagePath: string,
  cwd: string,
  clipModelId: ClassificationModelId,
  promptsFile: string,
  ttaCropCount: number
): Promise<{ clipNine: ReturnType<typeof scoreClipZeroShot>; imageEmb: Float32Array } | null> {
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

  const clipNine = scoreClipZeroShot(imageEmb, prompts)
  return { clipNine, imageEmb }
}

export async function classifyImage(
  imagePath: string,
  cwd: string,
  presetOrModelId?: string
): Promise<ImageClassificationResult> {
  const preset = getPresetById(resolvePresetId(presetOrModelId))
  const fileName = imagePath.split(/[/\\]/).pop() || imagePath

  if (presetOrModelId === 'cognivision') {
    return classifyWithCognivisionTf(imagePath, cwd)
  }

  const labels = loadImagenetLabels(cwd)

  try {
    const { imagenetNine } = await runImagenetBranch(
      imagePath,
      cwd,
      preset.imagenetModelId,
      labels,
      preset.ttaCropCount
    )

    const clipResult = await runClipBranch(
      imagePath,
      cwd,
      preset.clipModelId,
      preset.promptsFile,
      preset.ttaCropCount
    )

    if (!clipResult) {
      throw new Error(
        `CLIP 未就绪（需 ${preset.clipModelId} 与 ${preset.promptsFile}），请下载对应模型`
      )
    }

    const { clipNine, imageEmb } = clipResult
    const modelsDir = getModelsDir(cwd)
    const prompts = loadPromptsFile(modelsDir, preset.promptsFile)!

    let finalNine = fuseClipAndImagenetAdaptive(clipNine, imagenetNine, preset.fusionParams)
    finalNine = disambiguatePersonAnimalWithClip(finalNine, clipNine, preset.fusionParams)
    finalNine = applyCategoryDisambiguation(
      finalNine,
      imageEmb,
      prompts,
      undefined,
      preset.disambiguationShiftStrength
    )

    const { nine: gatedNine, confidenceScale } = applyConfidenceGate(
      finalNine,
      preset.confidenceGate.confMin,
      preset.confidenceGate.marginMin
    )

    const best = argmaxNine(gatedNine)
    const topPredictions = nineProbabilitiesToTopPredictions(gatedNine, 3, 0.05, 0.02)

    const sorted = (Object.entries(gatedNine) as [keyof typeof gatedNine, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    console.log(
      `[分类][${preset.id}] top3 ${fileName}:`,
      sorted.map(([k, v]) => `${k}=${(v * 100).toFixed(1)}%`).join(', ')
    )

    return {
      filePath: imagePath,
      category: best.category,
      confidence: Math.min(1, Math.max(0, best.confidence * confidenceScale)),
      topPredictions: topPredictions.map(tp => ({
        ...tp,
        confidence: Math.min(1, tp.confidence * confidenceScale)
      }))
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
