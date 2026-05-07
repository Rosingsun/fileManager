import type { ImageQualityItemResult, QuickFilterTier } from '../types'

export const QUICK_FILTER_COMPOSITION_FLAGS = new Set<ImageQualityItemResult['flags'][number]>([
  'subjectVeryCentered',
  'subjectOffThirds',
  'subjectNearEdge'
])

/**「按标记整理」时使用的子文件夹名称（与界面 Tag 文案一致） */
export function getQuickFilterOrganizeFolderName(item: ImageQualityItemResult): string {
  if (!item.ok) return '分析失败'
  const f = item.flags
  if (f.includes('overexposed') && f.includes('underexposed')) return '曝光矛盾'
  if (f.includes('overexposed')) return '过曝'
  if (f.includes('underexposed')) return '欠曝'
  if (f.includes('lowContrast')) return '低对比'
  if (f.some(x => QUICK_FILTER_COMPOSITION_FLAGS.has(x))) return '构图提示'
  return '未标记'
}

/**
 * 根据分析结果启发式建议整理档位（仅供参考，非审美结论）。
 */
export function suggestQuickFilterTier(item: ImageQualityItemResult): QuickFilterTier {
  if (!item.ok) return 'low'

  const flags = item.flags
  if (flags.length === 0) return 'high'

  const hasOver = flags.includes('overexposed')
  const hasUnder = flags.includes('underexposed')
  if (hasOver && hasUnder) return 'low'

  const exposureContrast = flags.filter(
    f => f === 'overexposed' || f === 'underexposed' || f === 'lowContrast'
  )
  const composition = flags.filter(f => QUICK_FILTER_COMPOSITION_FLAGS.has(f))

  if (flags.length >= 2) return 'low'

  if (exposureContrast.length === 1 && composition.length === 0) {
    return exposureContrast[0] === 'lowContrast' ? 'medium' : 'medium'
  }

  if (composition.length >= 1 && exposureContrast.length === 0) {
    return 'medium'
  }

  return 'low'
}
