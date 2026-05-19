import {
  DEFAULT_IMAGE_QUALITY_THRESHOLDS,
  type ImageQualityFlag,
  type ImageQualityItemResult,
  type ImageQualityScanConfig,
  type ImageQualityScanProgress,
  type ImageQualityScanResult,
  type ImageQualityThresholds,
  type QuickFilterTier,
} from '../../types'

export type QuickFilterWorkflowStep = 'config' | 'scan' | 'review'

export type FilterChip =
  | 'all'
  | 'overexposed'
  | 'underexposed'
  | 'lowContrast'
  | 'composition'
  | 'blurry'
  | 'noisy'
  | 'colorCast'

export type SensitivityPresetId = 'loose' | 'recommended' | 'strict'

export const WORKFLOW_STEPS: {
  key: QuickFilterWorkflowStep
  label: string
  short: string
}[] = [
  { key: 'config', label: '选择目录与策略', short: '配置' },
  { key: 'scan', label: '分析图片质量', short: '分析' },
  { key: 'review', label: '审阅并整理', short: '审阅' },
]

export const SENSITIVITY_PRESETS: {
  id: SensitivityPresetId
  label: string
  hint: string
}[] = [
  { id: 'loose', label: '宽松', hint: '标记更少' },
  { id: 'recommended', label: '推荐', hint: '默认平衡' },
  { id: 'strict', label: '严格', hint: '标记更多' },
]

export const TIER_LABEL: Record<QuickFilterTier, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export const TIER_DIR: Record<QuickFilterTier, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export const FLAG_LABEL: Record<ImageQualityFlag, string> = {
  overexposed: '过曝',
  underexposed: '欠曝',
  lowContrast: '低对比',
  subjectVeryCentered: '居中',
  subjectOffThirds: '偏离三分',
  subjectNearEdge: '贴边',
  blurry: '模糊',
  noisy: '噪点',
  colorCast: '色偏',
}

export const SCAN_STAGE_PIPELINE: {
  status: ImageQualityScanProgress['status']
  label: string
}[] = [
  { status: 'scanning', label: '枚举' },
  { status: 'analyzing', label: '分析' },
]

export const statusMeta: Record<
  ImageQualityScanProgress['status'],
  { label: string; className: string }
> = {
  scanning: { label: '正在枚举图片…', className: 'is-scanning' },
  analyzing: { label: '正在分析图片…', className: 'is-analyzing' },
  completed: { label: '分析完成', className: 'is-completed' },
  error: { label: '分析出错', className: 'is-error' },
  cancelled: { label: '已取消', className: 'is-cancelled' },
}

const PRESET_THRESHOLDS: Record<SensitivityPresetId, ImageQualityThresholds> = {
  recommended: { ...DEFAULT_IMAGE_QUALITY_THRESHOLDS },
  loose: {
    ...DEFAULT_IMAGE_QUALITY_THRESHOLDS,
    highlightClipRatio: 0.08,
    shadowClipRatio: 0.08,
    lowContrastStd: 12,
    overexposedMeanLuma: 210,
    underexposedMeanLuma: 55,
    compositionCenterEnergyRatio: 0.58,
    compositionCentroidOffThirdsMin: 0.18,
    compositionNearEdge: 0.11,
    minSharpnessLapMean: 7,
    maxNoiseLevel: 20,
    maxColorCastScore: 0.18,
  },
  strict: {
    ...DEFAULT_IMAGE_QUALITY_THRESHOLDS,
    highlightClipRatio: 0.04,
    shadowClipRatio: 0.04,
    lowContrastStd: 18,
    overexposedMeanLuma: 190,
    underexposedMeanLuma: 40,
    compositionCenterEnergyRatio: 0.48,
    compositionCentroidOffThirdsMin: 0.26,
    compositionNearEdge: 0.07,
    minSharpnessLapMean: 12,
    maxNoiseLevel: 12,
    maxColorCastScore: 0.1,
  },
}

export function thresholdsToFormFields(th: ImageQualityThresholds) {
  return {
    highlightClipRatio: Math.round(th.highlightClipRatio * 100),
    shadowClipRatio: Math.round(th.shadowClipRatio * 100),
    lowContrastStd: th.lowContrastStd,
    overexposedMeanLuma: th.overexposedMeanLuma,
    underexposedMeanLuma: th.underexposedMeanLuma,
    compositionCenterEnergyRatio: Math.round(th.compositionCenterEnergyRatio * 100),
    compositionCentroidOffThirdsMin: Math.round(th.compositionCentroidOffThirdsMin * 100),
    compositionNearEdge: Math.round(th.compositionNearEdge * 100),
    minSharpnessLapMean: th.minSharpnessLapMean,
    maxNoiseLevel: th.maxNoiseLevel,
    maxColorCastScore: Math.round(th.maxColorCastScore * 100),
  }
}

export function getPresetFormFields(presetId: SensitivityPresetId) {
  return thresholdsToFormFields(PRESET_THRESHOLDS[presetId])
}

export const QUICK_FILTER_FORM_INITIAL = {
  includeSubdirectories: true,
  scanPath: '',
  minFileSizeKb: undefined as number | undefined,
  maxFileSizeMb: undefined as number | undefined,
  excludedFolders: '',
  excludedExtensions: '',
  analysisLongEdge: 640,
  maxConcurrent: 3,
  sensitivityPreset: 'recommended' as SensitivityPresetId,
  ...thresholdsToFormFields(DEFAULT_IMAGE_QUALITY_THRESHOLDS),
}

export function buildImageQualityConfig(values: Record<string, unknown>): ImageQualityScanConfig {
  const th: ImageQualityThresholds = {
    highlightClipRatio: (values.highlightClipRatio as number) / 100,
    shadowClipRatio: (values.shadowClipRatio as number) / 100,
    lowContrastStd: values.lowContrastStd as number,
    overexposedMeanLuma: values.overexposedMeanLuma as number,
    underexposedMeanLuma: values.underexposedMeanLuma as number,
    compositionCenterEnergyRatio: (values.compositionCenterEnergyRatio as number) / 100,
    compositionCentroidOffThirdsMin: (values.compositionCentroidOffThirdsMin as number) / 100,
    compositionNearEdge: (values.compositionNearEdge as number) / 100,
    minSharpnessLapMean: values.minSharpnessLapMean as number,
    maxNoiseLevel: values.maxNoiseLevel as number,
    maxColorCastScore: (values.maxColorCastScore as number) / 100,
  }
  return {
    scanPath: values.scanPath as string,
    includeSubdirectories: (values.includeSubdirectories as boolean) ?? true,
    minFileSize: values.minFileSizeKb ? (values.minFileSizeKb as number) * 1024 : undefined,
    maxFileSize: values.maxFileSizeMb ? (values.maxFileSizeMb as number) * 1024 * 1024 : undefined,
    excludedFolders: values.excludedFolders
      ? String(values.excludedFolders)
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    excludedExtensions: values.excludedExtensions
      ? String(values.excludedExtensions)
          .split(',')
          .map((s) => s.trim().replace('.', ''))
          .filter(Boolean)
      : [],
    analysisLongEdge: values.analysisLongEdge as number,
    maxConcurrent: values.maxConcurrent as number,
    thresholds: th,
  }
}

export function getActiveWorkflowStep(
  config: ImageQualityScanConfig | null,
  scanning: boolean,
  hasResult: boolean
): QuickFilterWorkflowStep {
  if (hasResult && !scanning) return 'review'
  if (scanning || (config && !hasResult)) return 'scan'
  return 'config'
}

export function basename(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx >= 0 ? filePath.slice(idx + 1) : filePath
}

export function joinPath(...parts: string[]): string {
  if (parts.length === 0) return ''
  const sep = parts[0].includes('\\') ? '\\' : '/'
  const normalized = parts.map((part, index) => {
    if (index === 0) return part.replace(/[\\/]+$/, '')
    return part.replace(/^[\\/]+|[\\/]+$/g, '')
  })
  return normalized.filter(Boolean).join(sep)
}

export function hasCompositionFlag(flags: ImageQualityFlag[]): boolean {
  return flags.some(
    (f) => f === 'subjectVeryCentered' || f === 'subjectOffThirds' || f === 'subjectNearEdge'
  )
}

export function filterItemsByChip(
  items: ImageQualityItemResult[],
  chip: FilterChip
): ImageQualityItemResult[] {
  if (chip === 'all') return items
  if (chip === 'composition') return items.filter((r) => hasCompositionFlag(r.flags))
  return items.filter((r) => r.flags.includes(chip))
}

export function countByChip(items: ImageQualityItemResult[]): Record<FilterChip, number> {
  return {
    all: items.length,
    overexposed: items.filter((r) => r.flags.includes('overexposed')).length,
    underexposed: items.filter((r) => r.flags.includes('underexposed')).length,
    lowContrast: items.filter((r) => r.flags.includes('lowContrast')).length,
    composition: items.filter((r) => hasCompositionFlag(r.flags)).length,
    blurry: items.filter((r) => r.flags.includes('blurry')).length,
    noisy: items.filter((r) => r.flags.includes('noisy')).length,
    colorCast: items.filter((r) => r.flags.includes('colorCast')).length,
  }
}

export function removePathsFromScanResult(
  prev: ImageQualityScanResult | null,
  paths: Set<string>
): ImageQualityScanResult | null {
  if (!prev) return null
  return {
    ...prev,
    items: prev.items.filter((i) => !paths.has(i.filePath)),
  }
}

export const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'overexposed', label: '过曝' },
  { key: 'underexposed', label: '欠曝' },
  { key: 'lowContrast', label: '低对比' },
  { key: 'blurry', label: '模糊' },
  { key: 'noisy', label: '噪点' },
  { key: 'colorCast', label: '色偏' },
  { key: 'composition', label: '构图' },
]
