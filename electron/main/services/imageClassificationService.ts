import type { ImageClassificationResult } from '../../../src/types'
import { classifyImagePipeline } from '../classification/pipeline'
import {
  getPresetById,
  legacyModelIdToPreset,
  type ClassificationPresetId
} from '../utils/classificationPresets'
import { clearImagenetSessionCache } from '../classification/imagenetFallback'
import { clearClipModelCache } from '../utils/clipClassifier'
import { clearCalibrationCache } from '../classification/calibration'

function resolvePresetId(presetOrModelId?: string): ClassificationPresetId {
  if (!presetOrModelId) return legacyModelIdToPreset()
  return legacyModelIdToPreset(presetOrModelId)
}

export async function classifyImage(
  imagePath: string,
  cwd: string,
  presetOrModelId?: string
): Promise<ImageClassificationResult> {
  const preset = getPresetById(resolvePresetId(presetOrModelId))
  const fileName = imagePath.split(/[/\\]/).pop() || imagePath

  if (presetOrModelId === 'cognivision') {
    console.warn('[分类] cognivision 已废弃，使用 accuracy_fast')
    const fastPreset = getPresetById('accuracy_fast')
    return classifyImagePipeline({ imagePath, cwd, preset: fastPreset })
  }

  try {
    return await classifyImagePipeline({ imagePath, cwd, preset })
  } catch (error) {
    console.error(`[分类] 失败 (${fileName}):`, error)
    const message = error instanceof Error ? error.message : String(error)
    return {
      filePath: imagePath,
      category: 'other',
      confidence: 0,
      classificationStatus: 'failed',
      failureReason: message
    }
  }
}

export function clearClassificationCaches(): void {
  clearImagenetSessionCache()
  clearClipModelCache()
  clearCalibrationCache()
}

export { clearImagenetSessionCache } from '../classification/imagenetFallback'
