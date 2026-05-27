import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-cpu'
import type { MobileNet } from '@tensorflow-models/mobilenet'
import sharp from 'sharp'
import type { ImageClassificationResult } from '../../../src/types'
import {
  softmax,
  aggregateImagenetToNine,
  rebalancePersonAnimalFromTopPredictions,
  argmaxNine,
  nineProbabilitiesToTopPredictions
} from '../utils/imagenetNine'

let labelsCache: string[] | null = null

function loadImagenetLabels(cwd: string): string[] {
  if (labelsCache?.length === 1000) return labelsCache
  const p = join(cwd, 'models', 'imagenet1000.json')
  if (!existsSync(p)) {
    throw new Error(`缺少 ImageNet 标签: ${p}`)
  }
  const arr = JSON.parse(readFileSync(p, 'utf-8')) as string[]
  if (!Array.isArray(arr) || arr.length !== 1000) {
    throw new Error(`ImageNet 标签应为 1000 条，当前 ${arr?.length}`)
  }
  labelsCache = arr
  return arr
}

let mobilenetModel: MobileNet | null = null
let loadPromise: Promise<MobileNet> | null = null

async function getMobilenet(): Promise<MobileNet> {
  if (mobilenetModel) return mobilenetModel
  if (!loadPromise) {
    loadPromise = (async () => {
      const mobilenet = await import('@tensorflow-models/mobilenet')
      await tf.setBackend('cpu')
      await tf.ready()
      const m = await mobilenet.load({ version: 2, alpha: 1.0 })
      mobilenetModel = m
      console.log('[CogniVision] TensorFlow.js MobileNet 已加载')
      return m
    })()
  }
  return loadPromise
}

export function clearCognivisionMobilenetCache(): void {
  try {
    mobilenetModel?.dispose?.()
  } catch {
    /* ignore */
  }
  mobilenetModel = null
  loadPromise = null
}

/**
 * TensorFlow.js MobileNet（与 npm「cognivision」包相同的推理栈）→ ImageNet 1000 logits → 九大类聚合
 */
export async function classifyWithCognivisionTf(
  imagePath: string,
  cwd: string
): Promise<ImageClassificationResult> {
  const fileName = imagePath.split(/[/\\]/).pop() || imagePath
  const labels = loadImagenetLabels(cwd)

  try {
    const model = await getMobilenet()
    const { data, info } = await sharp(imagePath)
      .rotate()
      .resize(224, 224, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    if (info.channels !== 3) {
      throw new Error(`期望 RGB 三通道，当前 ${info.channels}`)
    }

    const u8 = new Uint8Array(data)
    const input3d = tf.tensor3d(u8, [224, 224, 3])
    let logitsTensor: tf.Tensor | null = null
    try {
      logitsTensor = model.infer(input3d, false)
      const logits = logitsTensor.dataSync()
      let off = 0
      let n = Math.min(1000, logits.length)
      if (logits.length === 1001) {
        off = 1
        n = 1000
      }
      if (logits.length > 1001) {
        console.warn(`[CogniVision] logits 长度 ${logits.length}，使用前 1000 维`)
      }
      const logitsSlice = new Float32Array(n)
      for (let i = 0; i < n; i++) logitsSlice[i] = logits[off + i]
      const probs = softmax(logitsSlice)
      let nine = aggregateImagenetToNine(probs, labels.slice(0, n))
      nine = rebalancePersonAnimalFromTopPredictions(probs, labels.slice(0, n), nine)
      const best = argmaxNine(nine)
      const topPredictions = nineProbabilitiesToTopPredictions(nine, 3, 0.05, 0.02)

      return {
        filePath: imagePath,
        category: best.category,
        confidence: best.confidence,
        topPredictions
      }
    } finally {
      logitsTensor?.dispose()
      input3d.dispose()
    }
  } catch (error) {
    console.error(`[CogniVision] 分类失败 (${fileName}):`, error)
    return {
      filePath: imagePath,
      category: 'other',
      confidence: 0
    }
  }
}
