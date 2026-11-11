import type { ImageClassificationResult, ImageContentCategory } from '../../../src/types'
import type { ClassificationPreset } from '../utils/classificationPresets'
import { getPresetCalibration } from './calibration'
import { runClipInference } from './clipEngine'
import { runImagenetFallback, loadImagenetLabels } from './imagenetFallback'
import {
  argmaxNine,
  nineProbabilitiesToTopPredictions,
  blendNine,
  getTopMargin
} from './decision'
import type { NineProbabilities } from './types'
import { applyCategoryDisambiguation } from '../utils/categoryDisambiguation'
import type { ConfidenceConfig } from './calibration'

export interface ClassifyPipelineOptions {
  imagePath: string
  cwd: string
  preset: ClassificationPreset
}

function sigmoid(x: number): number {
  if (x >= 0) return 1 / (1 + Math.exp(-Math.min(30, x)))
  const e = Math.exp(Math.max(-30, x))
  return e / (1 + e)
}

/** 用离线逻辑回归把 (top, margin) 映射为"这张图判对了吗"的可信概率 */
function calibratedConfidence(top: number, margin: number, c: ConfidenceConfig): number {
  const z = (c.topCoef ?? 2) * top + (c.marginCoef ?? 1) * margin + (c.intercept ?? -1)
  return Math.min(1, Math.max(0, sigmoid(z)))
}

export async function classifyImagePipeline(
  options: ClassifyPipelineOptions
): Promise<ImageClassificationResult> {
  const { imagePath, cwd, preset } = options
  const fileName = imagePath.split(/[/\\]/).pop() || imagePath
  const cal = getPresetCalibration(cwd, preset.id)

  const clipResult = await runClipInference(
    imagePath,
    cwd,
    preset.clipModelId,
    preset.promptsFile,
    preset.ttaCropCount,
    cal.clipScoring
  )

  if (!clipResult) {
    return {
      filePath: imagePath,
      category: 'other',
      confidence: 0,
      classificationStatus: 'failed',
      failureReason: `CLIP 未就绪（需 ${preset.clipModelId} 与真实文本嵌入 ${preset.promptsFile}），请下载模型并运行 npm run gen:clip-prompts`
    }
  }

  const { clipNine, imageEmb, prompts } = clipResult
  let finalNine: NineProbabilities = { ...clipNine }

  // 融合权重由交叉验证标定；为 0 时完全不加载 ImageNet 模型，避免无谓开销
  const imagenetWeight = Math.min(1, Math.max(0, cal.fusion.imagenetWeight ?? 0))
  if (imagenetWeight > 0 && preset.imagenetModelId) {
    try {
      const labels = loadImagenetLabels(cwd)
      const imagenetNine = await runImagenetFallback(
        imagePath,
        cwd,
        preset.imagenetModelId,
        labels,
        preset.ttaCropCount
      )
      if (imagenetNine) {
        finalNine = blendNine(clipNine, imagenetNine, 1 - imagenetWeight)
      }
    } catch (e) {
      console.warn('[分类] ImageNet 融合分支跳过', e)
    }
  }

  if ((cal.disambiguation.shiftStrength ?? 0) > 0) {
    finalNine = applyCategoryDisambiguation(
      finalNine,
      imageEmb,
      prompts,
      undefined,
      cal.disambiguation.shiftStrength
    )
  }

  const { top, margin } = getTopMargin(finalNine)
  const best = argmaxNine(finalNine)
  const abstained = top < (cal.abstain.confMin ?? 0) || margin < (cal.abstain.marginMin ?? 0)
  const category: ImageContentCategory = abstained ? 'other' : best.category
  const confidence = calibratedConfidence(top, margin, cal.confidence)
  const status = abstained || confidence < (cal.confidence.reviewBelow ?? 0.5) ? 'uncertain' : 'ok'

  const topPredictions = nineProbabilitiesToTopPredictions(finalNine, 3, 0.02, 0.01)

  const sorted = (Object.entries(finalNine) as [keyof typeof finalNine, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  console.log(
    `[分类][${preset.id}] ${fileName}: ${category} 可信度=${(confidence * 100).toFixed(0)}% ` +
    `top3 ${sorted.map(([k, v]) => `${k}=${(v * 100).toFixed(1)}%`).join(', ')}`
  )

  return {
    filePath: imagePath,
    category,
    confidence,
    classificationStatus: status,
    topPredictions: topPredictions.map(tp => ({
      category: tp.category,
      // topPredictions 表示九类相对分布，与可信度（判对概率）语义不同
      confidence: Math.min(1, Math.max(0, tp.confidence))
    }))
  }
}
