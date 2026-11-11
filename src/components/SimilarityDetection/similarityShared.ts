import type {
  SimilarityScanConfig,
  SimilarityScanProgress,
  SimilarityScanResult,
  SimilarityDetectionMode,
  SimilarityTier
} from '../../types'

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

/** 阈值由 npm run calib:similarity 网格搜索标定；预设为实测可用区间 */
export const THRESHOLD_PRESETS = [
  { label: '召回', value: 80, hint: '标定最优' },
  { label: '平衡', value: 86, hint: '推荐' },
  { label: '严格', value: 92, hint: '仅高度一致' },
] as const

/** 三档检测范围：exact 与 near 可批量清理，scene 仅供参考且不可删除 */
export const DETECTION_MODE_OPTIONS: {
  value: SimilarityDetectionMode
  name: string
  desc: string
  iconKey: 'hash' | 'phash' | 'both'
  safe: boolean
}[] = [
  { value: 'exact', name: '完全重复', desc: '仅字节一致', iconKey: 'hash', safe: true },
  { value: 'near', name: '近重复', desc: '压缩/调色/裁剪 · 推荐', iconKey: 'phash', safe: true },
  { value: 'scene', name: '同场景', desc: 'CLIP 语义 · 仅供参考', iconKey: 'both', safe: false },
]

export const TIER_META: Record<SimilarityTier, { label: string; hint: string; tone: string }> = {
  exact: { label: '完全重复', hint: 'MD5 一致，可安全清理', tone: 'is-exact' },
  near: { label: '近重复', hint: '感知指纹一致，可安全清理', tone: 'is-near' },
  scene: { label: '同场景', hint: '语义相近，仅供参考，不可批量删除', tone: 'is-scene' },
}

/** 兼容旧配置对象与结果页文案 */
export function getAlgorithmLabel(
  algorithm: SimilarityScanConfig['algorithm'] | SimilarityDetectionMode | undefined
): string {
  const mode = (algorithm as SimilarityDetectionMode) || 'near'
  const opt = DETECTION_MODE_OPTIONS.find((o) => o.value === mode)
  if (opt) return `${opt.name}模式`
  if (algorithm === 'hash') return '完全重复模式'
  if (algorithm === 'both' || algorithm === 'phash') return '近重复模式'
  return String(algorithm ?? '近重复模式')
}

export const SCAN_STAGE_PIPELINE: {
  status: SimilarityScanProgress['status']
  label: string
}[] = [
  { status: 'scanning', label: '扫描' },
  { status: 'hashing', label: '指纹' },
  { status: 'comparing', label: '比对' },
  { status: 'semantic', label: '语义' },
]

export const statusMeta: Record<
  SimilarityScanProgress['status'],
  { label: string; className: string }
> = {
  scanning: { label: '正在扫描文件…', className: 'is-scanning' },
  hashing: { label: '正在计算图像指纹…', className: 'is-hashing' },
  comparing: { label: '正在比对相似照片…', className: 'is-comparing' },
  semantic: { label: '正在分析同场景参考组…', className: 'is-semantic' },
  completed: { label: '扫描完成', className: 'is-completed' },
  error: { label: '扫描出错', className: 'is-error' },
  cancelled: { label: '已取消', className: 'is-cancelled' },
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

export const DUPLICATE_FOLDER_NAME = '重复照片'

export function getDefaultDuplicateFolder(scanPath: string): string {
  return joinPath(scanPath, DUPLICATE_FOLDER_NAME)
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter((p) => p.length > 0)
    .join('\\')
    .replace(/[/\\]+/g, '\\')
}

/** 从扫描结果中移除已移动/删除的路径，并重新计算统计 */
export function removePathsFromSimilarityResult(
  prev: SimilarityScanResult,
  removedPaths: Set<string>
): SimilarityScanResult {
  const groups = prev.groups
    .map((group) => {
      const images = group.images.filter((img) => !removedPaths.has(img.filePath))
      let recommendedKeep = group.recommendedKeep
      if (recommendedKeep && removedPaths.has(recommendedKeep)) {
        recommendedKeep = images[0]?.filePath
      }
      return { ...group, images, recommendedKeep }
    })
    .filter((g) => g.images.length >= 2)

  let potentialSpaceSaved = 0
  for (const group of groups) {
    const keepPath = group.recommendedKeep ?? group.images[0]?.filePath
    for (const img of group.images) {
      if (img.filePath !== keepPath) potentialSpaceSaved += img.size
    }
  }

  return {
    ...prev,
    groups,
    totalGroups: groups.length,
    totalImages: groups.reduce((sum, g) => sum + g.images.length, 0),
    potentialSpaceSaved,
  }
}
