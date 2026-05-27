import type { ClassificationModelId } from './classificationModels'
import type { FusionParams } from './imagenetNine'
import {
  FUSION_PARAMS_LIGHT,
  FUSION_PARAMS_BALANCED,
  FUSION_PARAMS_MAX
} from './imagenetNine'

export type ClassificationPresetId =
  | 'accuracy_light'
  | 'accuracy_balanced'
  | 'accuracy_max'

export interface ClassificationPreset {
  id: ClassificationPresetId
  name: string
  description: string
  clipModelId: ClassificationModelId
  imagenetModelId: ClassificationModelId
  promptsFile: string
  ttaCropCount: number
  estimatedSpeedFactor: number
  totalSizeMB: number
  fusionParams: FusionParams
  confidenceGate: { confMin: number; marginMin: number }
  disambiguationShiftStrength: number
}

export const CLASSIFICATION_PRESETS: ClassificationPreset[] = [
  {
    id: 'accuracy_light',
    name: '轻量精准',
    description: 'CLIP B/32 + MobileNet，无多裁剪，速度最快',
    clipModelId: 'clip_vit_b32_quant',
    imagenetModelId: 'mobilenetv2',
    promptsFile: 'clip-prompts.json',
    ttaCropCount: 1,
    estimatedSpeedFactor: 1,
    totalSizeMB: 104,
    fusionParams: FUSION_PARAMS_LIGHT,
    confidenceGate: { confMin: 0.28, marginMin: 0.06 },
    disambiguationShiftStrength: 0.2
  },
  {
    id: 'accuracy_balanced',
    name: '平衡精准',
    description: 'CLIP B/32 + EfficientNet-B4 + 3 裁剪平均，推荐默认',
    clipModelId: 'clip_vit_b32_quant',
    imagenetModelId: 'efficientnet_b4',
    promptsFile: 'clip-prompts.json',
    ttaCropCount: 3,
    estimatedSpeedFactor: 2.5,
    totalSizeMB: 179,
    fusionParams: FUSION_PARAMS_BALANCED,
    confidenceGate: { confMin: 0.26, marginMin: 0.05 },
    disambiguationShiftStrength: 0.22
  },
  {
    id: 'accuracy_max',
    name: '最高精准',
    description: 'CLIP L/14 + EfficientNet-B4 + 5 裁剪平均，精准度最高',
    clipModelId: 'clip_vit_l14_quant',
    imagenetModelId: 'efficientnet_b4',
    promptsFile: 'clip-prompts-l14.json',
    ttaCropCount: 5,
    estimatedSpeedFactor: 5,
    totalSizeMB: 249,
    fusionParams: FUSION_PARAMS_MAX,
    confidenceGate: { confMin: 0.24, marginMin: 0.04 },
    disambiguationShiftStrength: 0.25
  }
]

export const DEFAULT_PRESET_ID: ClassificationPresetId = 'accuracy_balanced'

export const CLASSIFICATION_PRESET_STORAGE_KEY = 'classification_selected_preset'

/** 与预设 ID 一一对应，供下载/校验在 isPresetId 异常时兜底 */
export const PRESET_DOWNLOAD_IDS: readonly ClassificationPresetId[] = [
  'accuracy_light',
  'accuracy_balanced',
  'accuracy_max'
]

export function getPresetById(id?: string | null): ClassificationPreset {
  const found = CLASSIFICATION_PRESETS.find(p => p.id === id)
  return found ?? CLASSIFICATION_PRESETS.find(p => p.id === DEFAULT_PRESET_ID)!
}

/** preset 所需的 ONNX 模型 ID（不含 prompts json） */
export function getPresetRequiredModelIds(preset: ClassificationPreset): ClassificationModelId[] {
  const ids = new Set<ClassificationModelId>([preset.imagenetModelId, preset.clipModelId])
  return [...ids]
}

export function isPresetId(value: string): value is ClassificationPresetId {
  return CLASSIFICATION_PRESETS.some(p => p.id === value)
}

export function isPresetDownloadId(value: string): value is ClassificationPresetId {
  const v = value.trim()
  return (PRESET_DOWNLOAD_IDS as readonly string[]).includes(v) || isPresetId(v)
}

/** 解析 IPC/前端传入的下载目标（避免非字符串或空串落入模型分支） */
export function parseDownloadTargetId(raw: unknown): string {
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (s) return s
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (typeof o.presetId === 'string' && o.presetId.trim()) return o.presetId.trim()
    if (typeof o.modelId === 'string' && o.modelId.trim()) return o.modelId.trim()
  }
  return DEFAULT_PRESET_ID
}

/** 旧版 modelId 映射到 preset */
export function legacyModelIdToPreset(modelId?: string): ClassificationPresetId {
  if (modelId === 'clip_vit_l14_quant') return 'accuracy_max'
  if (modelId === 'efficientnet_b4') return 'accuracy_balanced'
  if (isPresetId(modelId ?? '')) return modelId as ClassificationPresetId
  return DEFAULT_PRESET_ID
}
