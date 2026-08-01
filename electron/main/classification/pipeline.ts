import type { ImageClassificationResult } from '../../../src/types'
import type { ClassificationPreset } from '../utils/classificationPresets'
import { getPresetCalibration } from './calibration'
import { runClipInference } from './clipEngine'
import { runImagenetFallback, loadImagenetLabels } from './imagenetFallback'
import {
  argmaxNine,
  nineProbabilitiesToTopPredictions,
  applyConfidenceGate,
  blendNine,
  getTopMargin
} from './decision'
import type { NineProbabilities } from './types'
import { applyCategoryDisambiguation } from '../utils/categoryDisambiguation'

export interface ClassifyPipelineOptions {
  imagePath: string
  cwd: string
  preset: ClassificationPreset
}

function shouldUseImagenetFallback(
  clipNine: NineProbabilities,
  clipConfMin: number,
  clipMarginMin: number
): boolean {
  const { top, margin } = getTopMargin(clipNine)
  return top < clipConfMin || margin < clipMarginMin
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
      failureReason: `CLIP 未就绪（需 ${preset.clipModelId} 与 ${preset.promptsFile}），请下载对应模型`
    }
  }

  const { clipNine, imageEmb, prompts } = clipResult
  let finalNine: NineProbabilities = { ...clipNine }

  const inetCfg = cal.conditionalImagenet
  if (
    inetCfg.enabled &&
    preset.imagenetModelId &&
    shouldUseImagenetFallback(clipNine, inetCfg.clipConfMin, inetCfg.clipMarginMin)
  ) {
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
        finalNine = blendNine(clipNine, imagenetNine, 1 - inetCfg.imagenetWeight)
      }
    } catch (e) {
      console.warn('[分类] ImageNet 辅助分支跳过', e)
    }
  }

  finalNine = applyCategoryDisambiguation(
    finalNine,
    imageEmb,
    prompts,
    undefined,
    cal.disambiguation.shiftStrength
  )

  const { nine: gatedNine, confidenceScale, status } = applyConfidenceGate(
    finalNine,
    cal.confidenceGate.confMin,
    cal.confidenceGate.marginMin,
    cal.confidenceGate.uncertainScaleMin
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
    classificationStatus: status,
    topPredictions: topPredictions.map(tp => ({
      ...tp,
      confidence: Math.min(1, tp.confidence * confidenceScale)
    }))
  }
}
