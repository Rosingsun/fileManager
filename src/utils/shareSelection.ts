export type SelectionTier = 'must' | 'maybe' | 'reject'

export type ShareAssetVariant = 'original' | 'edited'

export interface SelectionPickState {
  cosKey: string
  tier: SelectionTier
  note: string
}

export const SELECTION_TIER_ORDER: SelectionTier[] = ['must', 'maybe', 'reject']

export const SELECTION_TIER_LABELS: Record<SelectionTier, string> = {
  must: '必选',
  maybe: '备选',
  reject: '淘汰',
}

export const SELECTION_TIER_COLORS: Record<SelectionTier, string> = {
  must: '#30b95a',
  maybe: '#ff9f0a',
  reject: '#8e8e93',
}

const PICKS_STORAGE_PREFIX = 'filedeal_share_picks_'

export function loadStoredPicks(token: string): Record<string, SelectionPickState> {
  try {
    const raw = localStorage.getItem(`${PICKS_STORAGE_PREFIX}${token}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SelectionPickState>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveStoredPicks(token: string, picks: Record<string, SelectionPickState>): void {
  try {
    localStorage.setItem(`${PICKS_STORAGE_PREFIX}${token}`, JSON.stringify(picks))
  } catch {
    /* ignore */
  }
}

export function clearStoredPicks(token: string): void {
  try {
    localStorage.removeItem(`${PICKS_STORAGE_PREFIX}${token}`)
  } catch {
    /* ignore */
  }
}

export function picksToSubmitItems(picks: Record<string, SelectionPickState>): {
  key: string
  tier: SelectionTier
  note?: string
}[] {
  return Object.values(picks).map((p) => ({
    key: p.cosKey,
    tier: p.tier,
    note: p.note.trim() || undefined,
  }))
}

export function exportPicksCsv(
  rows: { cosKey: string; tier: SelectionTier; note?: string | null }[],
  filename = 'selection-export.csv'
): void {
  const header = 'cosKey,tier,note'
  const lines = rows.map((r) => {
    const note = (r.note ?? '').replace(/"/g, '""')
    return `"${r.cosKey}","${r.tier}","${note}"`
  })
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function filterPicksByTier<T extends { tier?: SelectionTier }>(
  rows: T[],
  tier: SelectionTier | 'all'
): T[] {
  if (tier === 'all') return rows
  return rows.filter((r) => r.tier === tier)
}
