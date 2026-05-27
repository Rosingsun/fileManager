import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { ClassificationPresetId } from '../utils/classificationPresets'

export interface ClipScoringConfig {
  maxWeight: number
  meanWeight: number
  temperature: number
}

export interface ConditionalImagenetConfig {
  enabled: boolean
  imagenetWeight: number
  clipConfMin: number
  clipMarginMin: number
}

export interface ConfidenceGateConfig {
  confMin: number
  marginMin: number
  uncertainScaleMin: number
}

export interface DisambiguationConfig {
  shiftStrength: number
}

export interface CalibrationConfig {
  version: number
  clipScoring: ClipScoringConfig
  conditionalImagenet: ConditionalImagenetConfig
  confidenceGate: ConfidenceGateConfig
  disambiguation: DisambiguationConfig
  presetOverrides?: Partial<
    Record<
      ClassificationPresetId,
      {
        clipScoring?: Partial<ClipScoringConfig>
        conditionalImagenet?: Partial<ConditionalImagenetConfig>
        confidenceGate?: Partial<ConfidenceGateConfig>
        disambiguation?: Partial<DisambiguationConfig>
      }
    >
  >
}

const DEFAULT_CALIBRATION: CalibrationConfig = {
  version: 1,
  clipScoring: { maxWeight: 0.62, meanWeight: 0.38, temperature: 0.058 },
  conditionalImagenet: {
    enabled: true,
    imagenetWeight: 0.2,
    clipConfMin: 0.32,
    clipMarginMin: 0.08
  },
  confidenceGate: { confMin: 0.24, marginMin: 0.04, uncertainScaleMin: 0.55 },
  disambiguation: { shiftStrength: 0.25 }
}

let cached: CalibrationConfig | null = null
let cachedPath: string | null = null

function deepMerge<T extends Record<string, unknown>>(base: T, patch?: Partial<T>): T {
  if (!patch) return base
  const out = { ...base }
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const v = patch[key]
    if (v !== undefined && typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[key] = deepMerge(
        (base[key] ?? {}) as Record<string, unknown>,
        v as Record<string, unknown>
      ) as T[keyof T]
    } else if (v !== undefined) {
      out[key] = v as T[keyof T]
    }
  }
  return out
}

export function loadCalibration(cwd: string): CalibrationConfig {
  const p = join(cwd, 'models', 'classification-calibration.json')
  if (cached && cachedPath === p) return cached

  let base = DEFAULT_CALIBRATION
  if (existsSync(p)) {
    try {
      const raw = JSON.parse(readFileSync(p, 'utf-8')) as CalibrationConfig
      base = {
        ...DEFAULT_CALIBRATION,
        ...raw,
        clipScoring: { ...DEFAULT_CALIBRATION.clipScoring, ...raw.clipScoring },
        conditionalImagenet: {
          ...DEFAULT_CALIBRATION.conditionalImagenet,
          ...raw.conditionalImagenet
        },
        confidenceGate: { ...DEFAULT_CALIBRATION.confidenceGate, ...raw.confidenceGate },
        disambiguation: { ...DEFAULT_CALIBRATION.disambiguation, ...raw.disambiguation }
      }
    } catch (e) {
      console.warn('[分类] 读取 calibration.json 失败，使用默认值', e)
    }
  }

  cached = base
  cachedPath = p
  return base
}

export function getPresetCalibration(
  cwd: string,
  presetId: ClassificationPresetId
): {
  clipScoring: ClipScoringConfig
  conditionalImagenet: ConditionalImagenetConfig
  confidenceGate: ConfidenceGateConfig
  disambiguation: DisambiguationConfig
} {
  const base = loadCalibration(cwd)
  const override = base.presetOverrides?.[presetId]
  return {
    clipScoring: deepMerge(base.clipScoring, override?.clipScoring),
    conditionalImagenet: deepMerge(base.conditionalImagenet, override?.conditionalImagenet),
    confidenceGate: deepMerge(base.confidenceGate, override?.confidenceGate),
    disambiguation: deepMerge(base.disambiguation, override?.disambiguation)
  }
}

export function clearCalibrationCache(): void {
  cached = null
  cachedPath = null
}
