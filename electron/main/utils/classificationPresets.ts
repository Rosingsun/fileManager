import type { ClassificationModelId } from './classificationModels'

export type ClassificationPresetId =
  | 'accuracy_fast'
  | 'accuracy_max'
  /** @deprecated 映射到 accuracy_fast */
  | 'accuracy_light'
  /** @deprecated 映射到 accuracy_max */
  | 'accuracy_balanced'

export interface ClassificationPreset {
  id: ClassificationPresetId
  name: string
  description: string
  clipModelId: ClassificationModelId
  /** null 表示不使用 ImageNet 辅助 */
  imagenetModelId: ClassificationModelId | null
  promptsFile: string
  ttaCropCount: number
  estimatedSpeedFactor: number
  totalSizeMB: number
}

export const CLASSIFICATION_PRESETS: ClassificationPreset[] = [
  {
    id: 'accuracy_fast',
    name: '快速预览',
    description: 'CLIP B/32 单裁剪，速度快；评估集 Top-1 88.2%',
    clipModelId: 'clip_vit_b32_quant',
    imagenetModelId: null,
    promptsFile: 'clip-prompts.json',
    ttaCropCount: 1,
    estimatedSpeedFactor: 1,
    totalSizeMB: 90
  },
  {
    id: 'accuracy_max',
    name: '最高精准',
    description: 'CLIP L/14 + 5 裁剪 TTA；评估集 Top-1 91.7%，推荐默认',
    clipModelId: 'clip_vit_l14_quant',
    // 交叉验证表明 ImageNet 融合会降低 9 大类准确率（最优权重为 0），故不再加载辅助模型
    imagenetModelId: null,
    promptsFile: 'clip-prompts-l14.json',
    ttaCropCount: 5,
    estimatedSpeedFactor: 5,
    totalSizeMB: 300
  }
]

export const DEFAULT_PRESET_ID: ClassificationPresetId = 'accuracy_max'

export const CLASSIFICATION_PRESET_STORAGE_KEY = 'classification_selected_preset'

export const PRESET_DOWNLOAD_IDS: readonly ClassificationPresetId[] = [
  'accuracy_fast',
  'accuracy_max'
]

const PRESET_ALIASES: Record<string, ClassificationPresetId> = {
  accuracy_light: 'accuracy_fast',
  accuracy_balanced: 'accuracy_max'
}

export function normalizePresetId(id?: string | null): ClassificationPresetId {
  if (!id) return DEFAULT_PRESET_ID
  if (PRESET_ALIASES[id]) return PRESET_ALIASES[id]
  if (isPresetId(id)) return id
  return DEFAULT_PRESET_ID
}

export function getPresetById(id?: string | null): ClassificationPreset {
  const normalized = normalizePresetId(id)
  const found = CLASSIFICATION_PRESETS.find(p => p.id === normalized)
  return found ?? CLASSIFICATION_PRESETS.find(p => p.id === DEFAULT_PRESET_ID)!
}

export function getPresetRequiredModelIds(preset: ClassificationPreset): ClassificationModelId[] {
  const ids = new Set<ClassificationModelId>([preset.clipModelId])
  if (preset.imagenetModelId) ids.add(preset.imagenetModelId)
  return [...ids]
}

export function isPresetId(value: string): value is ClassificationPresetId {
  return (
    CLASSIFICATION_PRESETS.some(p => p.id === value) ||
    value === 'accuracy_light' ||
    value === 'accuracy_balanced'
  )
}

export function isPresetDownloadId(value: string): value is ClassificationPresetId {
  const v = value.trim()
  return (PRESET_DOWNLOAD_IDS as readonly string[]).includes(v) || isPresetId(v)
}

export function parseDownloadTargetId(raw: unknown): string {
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (s) return normalizePresetId(s)
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (typeof o.presetId === 'string' && o.presetId.trim()) {
      return normalizePresetId(o.presetId.trim())
    }
    if (typeof o.modelId === 'string' && o.modelId.trim()) {
      return normalizePresetId(o.modelId.trim())
    }
  }
  return DEFAULT_PRESET_ID
}

export function legacyModelIdToPreset(modelId?: string): ClassificationPresetId {
  if (modelId === 'clip_vit_l14_quant') return 'accuracy_max'
  if (modelId === 'clip_vit_b32_quant' || modelId === 'mobilenetv2') return 'accuracy_fast'
  if (modelId === 'efficientnet_b4') return 'accuracy_max'
  return normalizePresetId(modelId)
}
