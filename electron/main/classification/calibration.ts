import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { ImageContentCategory } from '../../../src/types'
import type { ClassificationPresetId } from '../utils/classificationPresets'

/** CLIP 零样本打分配置。logit = (1-maxBlend)*原型余弦 + maxBlend*最大余弦 + 类别偏置 */
export interface ClipScoringConfig {
  temperature: number
  maxBlend: number
  classBias: Partial<Record<ImageContentCategory, number>>
}

export interface FusionConfig {
  /** 最终概率 = (1-w)*CLIP + w*ImageNet 九类；0 表示纯 CLIP */
  imagenetWeight: number
}

export interface AbstainConfig {
  /** 最高概率低于该值，或 top1-top2 间隔小于该值时，判为 other 并标记 uncertain */
  confMin: number
  marginMin: number
}

/** 逻辑回归置信度：sigmoid(topCoef*top + marginCoef*margin + intercept)；低于 reviewBelow 标记待复核 */
export interface ConfidenceConfig {
  topCoef: number
  marginCoef: number
  intercept: number
  reviewBelow: number
}

export interface DisambiguationConfig {
  shiftStrength: number
}

export interface PresetCalibration {
  clipScoring: ClipScoringConfig
  fusion: FusionConfig
  abstain: AbstainConfig
  confidence: ConfidenceConfig
  disambiguation: DisambiguationConfig
}

export interface CalibrationConfig extends PresetCalibration {
  version: number
  generatedAt?: string
  method?: string
  sampleCount?: number
  presetOverrides?: Partial<Record<ClassificationPresetId, Partial<PresetCalibration>>>
  metrics?: Record<string, unknown>
}

const ZERO_BIAS: Partial<Record<ImageContentCategory, number>> = {
  person: 0, animal: 0, landscape: 0, urban: 0, indoor: 0,
  food: 0, vehicle: 0, document: 0, other: 0
}

/** 无标定文件时的保守默认：真实 CLIP 嵌入 + 中性参数，不会放大噪声 */
const DEFAULTS: CalibrationConfig = {
  version: 2,
  clipScoring: { temperature: 0.02, maxBlend: 0.2, classBias: { ...ZERO_BIAS } },
  fusion: { imagenetWeight: 0 },
  abstain: { confMin: 0, marginMin: 0 },
  confidence: { topCoef: 2, marginCoef: 1, intercept: -1, reviewBelow: 0 },
  disambiguation: { shiftStrength: 0 }
}

let cached: CalibrationConfig | null = null
let cachedPath: string | null = null

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function parseSection<T extends object>(raw: unknown, defaults: T, pick: (v: Record<string, unknown>, out: T) => void): T {
  const out = { ...defaults }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    pick(raw as Record<string, unknown>, out)
  }
  return out
}

function parsePreset(raw: unknown, base: PresetCalibration): PresetCalibration {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    clipScoring: parseSection(r.clipScoring, base.clipScoring, (v, o) => {
      o.temperature = num(v.temperature, o.temperature)
      o.maxBlend = num(v.maxBlend, o.maxBlend)
      if (v.classBias && typeof v.classBias === 'object') {
        o.classBias = { ...ZERO_BIAS, ...(v.classBias as object) } as typeof o.classBias
      }
    }),
    fusion: parseSection(r.fusion, base.fusion, (v, o) => {
      o.imagenetWeight = num(v.imagenetWeight, o.imagenetWeight)
    }),
    abstain: parseSection(r.abstain, base.abstain, (v, o) => {
      o.confMin = num(v.confMin, o.confMin)
      o.marginMin = num(v.marginMin, o.marginMin)
    }),
    confidence: parseSection(r.confidence, base.confidence, (v, o) => {
      o.topCoef = num(v.topCoef, o.topCoef)
      o.marginCoef = num(v.marginCoef, o.marginCoef)
      o.intercept = num(v.intercept, o.intercept)
      o.reviewBelow = num(v.reviewBelow, o.reviewBelow)
    }),
    disambiguation: parseSection(r.disambiguation, base.disambiguation, (v, o) => {
      o.shiftStrength = num(v.shiftStrength, o.shiftStrength)
    })
  }
}

export function loadCalibration(cwd: string): CalibrationConfig {
  const p = join(cwd, 'models', 'classification-calibration.json')
  if (cached && cachedPath === p) return cached

  let config: CalibrationConfig = { ...DEFAULTS }
  if (existsSync(p)) {
    try {
      const raw = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>
      const base: PresetCalibration = {
        clipScoring: { ...DEFAULTS.clipScoring },
        fusion: { ...DEFAULTS.fusion },
        abstain: { ...DEFAULTS.abstain },
        confidence: { ...DEFAULTS.confidence },
        disambiguation: { ...DEFAULTS.disambiguation }
      }
      const merged = parsePreset(raw, base)
      config = {
        ...merged,
        version: num(raw.version, 2),
        generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : undefined,
        method: typeof raw.method === 'string' ? raw.method : undefined,
        sampleCount: num(raw.sampleCount, 0),
        metrics: (raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : {}) as Record<string, unknown>,
        presetOverrides:
          raw.presetOverrides && typeof raw.presetOverrides === 'object'
            ? (raw.presetOverrides as CalibrationConfig['presetOverrides'])
            : undefined
      }
      if (config.version < 2) {
        console.warn('[分类] calibration.json 为旧版(v1)，请运行 npm run calib:classify 重新标定')
      }
    } catch (e) {
      console.warn('[分类] 读取 calibration.json 失败，使用默认参数', e)
    }
  }

  cached = config
  cachedPath = p
  return config
}

export function getPresetCalibration(cwd: string, presetId: ClassificationPresetId): PresetCalibration {
  const config = loadCalibration(cwd)
  const base: PresetCalibration = {
    clipScoring: config.clipScoring,
    fusion: config.fusion,
    abstain: config.abstain,
    confidence: config.confidence,
    disambiguation: config.disambiguation
  }
  const override = config.presetOverrides?.[presetId]
  return override ? parsePreset(override, base) : base
}

export function clearCalibrationCache(): void {
  cached = null
  cachedPath = null
}
