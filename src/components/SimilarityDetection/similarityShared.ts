import type { SimilarityScanConfig, SimilarityScanProgress } from '../../types'

export type SimilarityWorkflowStep = 'config' | 'scan' | 'review'

export const WORKFLOW_STEPS: {
  key: SimilarityWorkflowStep
  label: string
  short: string
}[] = [
  { key: 'config', label: '选择目录与策略', short: '配置' },
  { key: 'scan', label: '扫描并比对照片', short: '分析' },
  { key: 'review', label: '确认保留并清理', short: '审阅' },
]

export const INCLUDE_SUBDIRECTORIES_HINT =
  '开启：递归扫描所选目录下所有子文件夹中的图片。关闭：仅扫描当前所选目录根目录中的图片，不包含子文件夹。'

export const THRESHOLD_PRESETS = [
  { label: '宽松', value: 80, hint: '更多相似组' },
  { label: '普通', value: 90, hint: '推荐' },
  { label: '严格', value: 96, hint: '仅高度相似' },
] as const

export const ALGORITHM_OPTIONS: {
  value: SimilarityScanConfig['algorithm']
  name: string
  desc: string
  iconKey: 'hash' | 'phash' | 'both'
}[] = [
  { value: 'hash', name: '快速', desc: '完全重复', iconKey: 'hash' },
  { value: 'phash', name: '精确', desc: '视觉相似', iconKey: 'phash' },
  { value: 'both', name: '混合', desc: '推荐', iconKey: 'both' },
]

export function getAlgorithmLabel(algorithm: SimilarityScanConfig['algorithm']): string {
  const opt = ALGORITHM_OPTIONS.find((o) => o.value === algorithm)
  return opt ? `${opt.name}模式` : algorithm
}

export const SCAN_STAGE_PIPELINE: {
  status: SimilarityScanProgress['status']
  label: string
}[] = [
  { status: 'scanning', label: '扫描' },
  { status: 'hashing', label: '哈希' },
  { status: 'comparing', label: '比对' },
]

export const statusMeta: Record<
  SimilarityScanProgress['status'],
  { label: string; className: string }
> = {
  scanning: { label: '正在扫描文件…', className: 'is-scanning' },
  hashing: { label: '正在计算图像指纹…', className: 'is-hashing' },
  comparing: { label: '正在比对相似照片…', className: 'is-comparing' },
  completed: { label: '扫描完成', className: 'is-completed' },
  error: { label: '扫描出错', className: 'is-error' },
}

export function getActiveWorkflowStep(
  config: SimilarityScanConfig | null,
  scanning: boolean,
  hasResult: boolean
): SimilarityWorkflowStep {
  if (hasResult && !scanning) return 'review'
  if (scanning || (config && !hasResult)) return 'scan'
  return 'config'
}

export function basename(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx >= 0 ? filePath.slice(idx + 1) : filePath
}
