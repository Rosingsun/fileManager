import type { OperationLogEntry } from './operationLog'
import {
  operationLogCategoryOfAction,
  operationLogActionLabel,
  type OperationLogCategory,
  OPERATION_LOG_CATEGORY_LABELS,
} from './operationLogLabels'

export type OperationLogStatsRange = '7d' | '30d' | 'all'

export interface OperationLogCategoryStat {
  category: OperationLogCategory
  label: string
  count: number
}

export interface OperationLogLastAction {
  category: OperationLogCategory
  label: string
  action: string
  actionLabel: string
  ts: number
  summary?: string
}

export interface OperationLogStatsSummary {
  total: number
  byCategory: OperationLogCategoryStat[]
  lastByCategory: OperationLogLastAction[]
}

const CATEGORY_ORDER: OperationLogCategory[] = [
  'organize',
  'similarity',
  'classify',
  'quickFilter',
  'tools',
  'account',
  'other',
]

function rangeStartMs(range: OperationLogStatsRange, now = Date.now()): number | null {
  if (range === 'all') return null
  const days = range === '7d' ? 7 : 30
  return now - days * 24 * 60 * 60 * 1000
}

export function filterOperationLogsByRange(
  entries: OperationLogEntry[],
  range: OperationLogStatsRange,
  now = Date.now()
): OperationLogEntry[] {
  const start = rangeStartMs(range, now)
  if (start == null) return entries
  return entries.filter((e) => e.ts >= start)
}

export function aggregateOperationLogs(
  entries: OperationLogEntry[],
  range: OperationLogStatsRange = 'all'
): OperationLogStatsSummary {
  const filtered = filterOperationLogsByRange(entries, range)
  const counts = new Map<OperationLogCategory, number>()
  const lastMap = new Map<OperationLogCategory, OperationLogLastAction>()

  for (const cat of CATEGORY_ORDER) {
    counts.set(cat, 0)
  }

  const sorted = [...filtered].sort((a, b) => b.ts - a.ts)
  for (const entry of sorted) {
    const category = operationLogCategoryOfAction(entry.action)
    counts.set(category, (counts.get(category) ?? 0) + 1)
    if (!lastMap.has(category)) {
      lastMap.set(category, {
        category,
        label: OPERATION_LOG_CATEGORY_LABELS[category],
        action: entry.action,
        actionLabel: operationLogActionLabel(entry.action),
        ts: entry.ts,
        summary: entry.summary,
      })
    }
  }

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    label: OPERATION_LOG_CATEGORY_LABELS[category],
    count: counts.get(category) ?? 0,
  })).filter((c) => c.count > 0 || ['organize', 'similarity', 'classify', 'quickFilter', 'tools'].includes(c.category))

  const lastByCategory = CATEGORY_ORDER.map((c) => lastMap.get(c)).filter(
    (x): x is OperationLogLastAction => x != null
  )

  return {
    total: filtered.length,
    byCategory,
    lastByCategory,
  }
}
