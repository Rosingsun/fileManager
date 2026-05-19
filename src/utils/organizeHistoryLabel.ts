import type { OrganizeRule } from '../types'

const RULE_TYPE_LABELS: Record<OrganizeRule['type'], string> = {
  extension: '按扩展名',
  date: '按修改日期',
  size: '按文件大小',
  custom: '自定义规则'
}

const DATE_FORMAT_LABELS: Record<NonNullable<OrganizeRule['dateFormat']>, string> = {
  year: '按年',
  month: '按月',
  day: '按日'
}

export function formatOrganizeRuleLabel(rule: OrganizeRule): string {
  const base = RULE_TYPE_LABELS[rule.type] ?? rule.type
  if (rule.type === 'date' && rule.dateFormat) {
    return `${base} · ${DATE_FORMAT_LABELS[rule.dateFormat]}`
  }
  if (rule.type === 'custom' && rule.pattern?.trim()) {
    return `${base}（${rule.pattern.trim()}）`
  }
  return base
}

export const ORGANIZE_HISTORY_ACTION_LABELS: Record<
  import('../types').OrganizeHistoryAction,
  string
> = {
  organize: '执行整理',
  extract: '文件提取',
  preview: '预览整理'
}
