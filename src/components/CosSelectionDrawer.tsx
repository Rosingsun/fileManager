import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Drawer,
  Empty,
  Input,
  List,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import {
  cosMkdir,
  cosMove,
  formatAuthApiError,
  formatDateTime,
  markSelectionSeen,
  shareSelectionDiff,
  shareSelectionSubmissions,
  shareSelectionSummary,
  shareSelectionRemapKeys,
  exportPicksCsv,
  SELECTION_TIER_COLORS,
  SELECTION_TIER_LABELS,
  type SelectionTier,
  type ShareItem,
  type ShareSelectionPickSummary,
  type ShareSelectionSubmission,
} from '../utils'
import { cosPresignGet } from '../utils'

const SelectionThumb: React.FC<{ cosKey: string; fallbackKey?: string; title: string }> = ({
  cosKey,
  fallbackKey,
  title,
}) => {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setFailed(false)
    const tryKey = async (key: string): Promise<boolean> => {
      try {
        const { previewUrl } = await cosPresignGet({ key, variant: 'thumb' })
        if (!cancelled) setUrl(previewUrl)
        return true
      } catch {
        return false
      }
    }
    void (async () => {
      if (await tryKey(cosKey)) return
      if (fallbackKey && fallbackKey !== cosKey && (await tryKey(fallbackKey))) return
      if (!cancelled) setFailed(true)
    })()
    return () => {
      cancelled = true
    }
  }, [cosKey, fallbackKey])
  return (
    <div
      title={title}
      style={{
        width: 48,
        height: 48,
        borderRadius: 8,
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.04)',
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Typography.Text type="secondary" style={{ fontSize: 10, padding: 4 }}>
          {failed ? '无预览' : '…'}
        </Typography.Text>
      )}
    </div>
  )
}

function basename(key: string): string {
  return key.split('/').filter(Boolean).pop() || key
}

export interface CosSelectionDrawerProps {
  open: boolean
  onClose: () => void
  share: ShareItem | null
  /** 分享绑定的文件夹完整 COS 前缀（以 / 结尾） */
  folderFullPrefix: string
  /** 相对用户根的父目录，用于 mkdir */
  mkdirParentRelative?: string
  onRefreshFolder?: () => void
  onOpenBatchEdit?: (keys: string[]) => void
}

const CosSelectionDrawer: React.FC<CosSelectionDrawerProps> = ({
  open,
  onClose,
  share,
  folderFullPrefix,
  mkdirParentRelative,
  onRefreshFolder,
  onOpenBatchEdit,
}) => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [submissions, setSubmissions] = useState<ShareSelectionSubmission[]>([])
  const [submissionsTotal, setSubmissionsTotal] = useState(0)
  const [picks, setPicks] = useState<ShareSelectionPickSummary[]>([])
  const [tierFilter, setTierFilter] = useState<'all' | SelectionTier>('all')
  const [diffRoundA, setDiffRoundA] = useState(1)
  const [diffRoundB, setDiffRoundB] = useState(2)
  const [diffResult, setDiffResult] = useState<{ added: string[]; removed: string[]; unchanged: string[] } | null>(
    null
  )
  const [deliveryFolder, setDeliveryFolder] = useState('selected/')
  const [delivering, setDelivering] = useState(false)

  const load = useCallback(async () => {
    if (!share) return
    setLoading(true)
    try {
      const [subData, summary] = await Promise.all([
        shareSelectionSubmissions(share.id, { page: 1, pageSize: 50 }),
        shareSelectionSummary(share.id),
      ])
      setSubmissions(subData.items)
      setSubmissionsTotal(subData.total)
      setPicks(summary.picks)
      markSelectionSeen(share.id)
    } catch (e: unknown) {
      message.error(formatAuthApiError(e))
    } finally {
      setLoading(false)
    }
  }, [share, message])

  useEffect(() => {
    if (open && share) void load()
  }, [open, share, load])

  const filteredPicks = useMemo(() => {
    if (tierFilter === 'all') return picks
    return picks.filter((p) => {
      if (tierFilter === 'must') return p.mustCount > 0
      if (tierFilter === 'maybe') return p.maybeCount > 0
      return p.rejectCount > 0
    })
  }, [picks, tierFilter])

  const mustKeys = useMemo(
    () =>
      submissions
        .flatMap((s) => s.items.filter((i) => i.tier === 'must').map((i) => i.cosKey))
        .filter((k, i, arr) => arr.indexOf(k) === i),
    [submissions]
  )

  const copyKeys = async (keys: string[]) => {
    if (keys.length === 0) {
      message.warning('暂无 key')
      return
    }
    try {
      await navigator.clipboard.writeText(keys.join('\n'))
      message.success(`已复制 ${keys.length} 条`)
    } catch {
      message.error('复制失败')
    }
  }

  const deliverToFolder = async () => {
    if (!share || mustKeys.length === 0) {
      message.warning('暂无必选片可交付')
      return
    }
    const sub = deliveryFolder.trim().replace(/^\/+/, '')
    if (!sub.endsWith('/')) {
      message.warning('目标目录须以 / 结尾')
      return
    }
    const base = share.cosPrefix ?? folderFullPrefix
    const targetDir = `${base}${sub}`
    setDelivering(true)
    try {
      const dirName = sub.replace(/\/$/, '')
      await cosMkdir({ parentPrefix: mkdirParentRelative || undefined, name: dirName }).catch(() => {})
      const mappings: { fromKey: string; toKey: string }[] = []
      let ok = 0
      for (const fromKey of mustKeys) {
        const name = basename(fromKey)
        const toKey = `${targetDir}${name}`
        if (toKey === fromKey) continue
        try {
          const result = await cosMove({ fromKey, toKey })
          const resolvedTo = result.key?.trim().replace(/^\/+/, '') || toKey
          mappings.push({ fromKey, toKey: resolvedTo })
          ok += 1
        } catch {
          /* skip conflict */
        }
      }
      if (mappings.length > 0) {
        await shareSelectionRemapKeys(share.id, mappings)
        await load()
      }
      message.success(`已移动 ${ok} 张到 ${sub}`)
      onRefreshFolder?.()
    } catch (e: unknown) {
      message.error(formatAuthApiError(e))
    } finally {
      setDelivering(false)
    }
  }

  const runDiff = async () => {
    if (!share) return
    try {
      const data = await shareSelectionDiff(share.id, diffRoundA, diffRoundB)
      setDiffResult(data)
    } catch (e: unknown) {
      message.error(formatAuthApiError(e))
    }
  }

  const exportCsv = () => {
    const rows = submissions.flatMap((s) =>
      s.items.map((i) => ({ cosKey: i.cosKey, tier: i.tier, note: i.note }))
    )
    if (rows.length === 0) {
      message.warning('暂无数据')
      return
    }
    exportPicksCsv(rows, `selection-${share?.displayName ?? 'export'}.csv`)
  }

  return (
    <Drawer
      title={`选片反馈 · ${share?.displayName ?? ''}`}
      open={open}
      onClose={onClose}
      width={480}
      extra={
        share && (
          <Typography.Text type="secondary">第 {share.selectionRound} 轮</Typography.Text>
        )
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : !share ? (
        <Empty description="未找到分享" />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Button size="small" onClick={() => void copyKeys(mustKeys)}>
              复制必选 key
            </Button>
            <Button size="small" onClick={exportCsv}>
              导出 CSV
            </Button>
            {onOpenBatchEdit && (
              <Button size="small" type="link" onClick={() => onOpenBatchEdit(mustKeys)} disabled={mustKeys.length === 0}>
                批量编辑必选
              </Button>
            )}
          </Space>

          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              交付到子目录
            </Typography.Text>
            <Space.Compact style={{ width: '100%', marginTop: 8 }}>
              <Input value={deliveryFolder} onChange={(e) => setDeliveryFolder(e.target.value)} />
              <Button loading={delivering} onClick={() => void deliverToFolder()}>
                移动必选
              </Button>
            </Space.Compact>
          </div>

          <div>
            <Typography.Text strong>按图汇总</Typography.Text>
            <Segmented
              size="small"
              style={{ marginTop: 8, display: 'block' }}
              value={tierFilter}
              onChange={(v) => setTierFilter(v as 'all' | SelectionTier)}
              options={[
                { label: '全部', value: 'all' },
                { label: '必选', value: 'must' },
                { label: '备选', value: 'maybe' },
                { label: '淘汰', value: 'reject' },
              ]}
            />
            {filteredPicks.length === 0 ? (
              <Empty description="暂无" style={{ marginTop: 12 }} />
            ) : (
              <List
                size="small"
                style={{ marginTop: 8 }}
                dataSource={filteredPicks.slice(0, 40)}
                renderItem={(p) => (
                  <List.Item>
                    <SelectionThumb cosKey={p.cosKey} title={basename(p.cosKey)} />
                    <div style={{ flex: 1, marginLeft: 8, minWidth: 0 }}>
                      <Typography.Text ellipsis style={{ display: 'block', fontSize: 12 }}>
                        {basename(p.cosKey)}
                      </Typography.Text>
                      <Space size={4} wrap style={{ marginTop: 4 }}>
                        {p.mustCount > 0 && (
                          <Tag color={SELECTION_TIER_COLORS.must} style={{ margin: 0 }}>
                            必选 {p.mustCount}
                          </Tag>
                        )}
                        {p.maybeCount > 0 && (
                          <Tag color={SELECTION_TIER_COLORS.maybe} style={{ margin: 0 }}>
                            备选 {p.maybeCount}
                          </Tag>
                        )}
                        {p.rejectCount > 0 && (
                          <Tag color={SELECTION_TIER_COLORS.reject} style={{ margin: 0 }}>
                            淘汰 {p.rejectCount}
                          </Tag>
                        )}
                      </Space>
                      {p.notes.length > 0 && (
                        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                          {p.notes.join(' · ')}
                        </Typography.Text>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>

          <div>
            <Typography.Text strong>轮次对比</Typography.Text>
            <Space style={{ marginTop: 8 }} wrap>
              <Input
                type="number"
                min={1}
                max={99}
                value={diffRoundA}
                onChange={(e) => setDiffRoundA(Number(e.target.value) || 1)}
                style={{ width: 64 }}
                addonBefore="A"
              />
              <Input
                type="number"
                min={1}
                max={99}
                value={diffRoundB}
                onChange={(e) => setDiffRoundB(Number(e.target.value) || 2)}
                style={{ width: 64 }}
                addonBefore="B"
              />
              <Button size="small" onClick={() => void runDiff()}>
                对比
              </Button>
            </Space>
            {diffResult && (
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                新增 {diffResult.added.length} · 取消 {diffResult.removed.length} · 保留{' '}
                {diffResult.unchanged.length}
              </Typography.Paragraph>
            )}
          </div>

          <div>
            <Typography.Text strong>提交记录</Typography.Text>
            {submissions.length === 0 ? (
              <Empty description="暂无访客提交" style={{ marginTop: 12 }} />
            ) : (
              <List
                style={{ marginTop: 8 }}
                dataSource={submissions}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{item.pickerLabel?.trim() || '匿名访客'}</span>
                          <Tag>第 {item.selectionRound} 轮</Tag>
                        </Space>
                      }
                      description={`${formatDateTime(item.createdAt)} · ${item.itemCount} 张`}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {item.items.slice(0, 12).map((it) => (
                        <div key={`${item.id}-${it.cosKey}`} style={{ position: 'relative' }}>
                          <SelectionThumb cosKey={it.cosKey} title={basename(it.cosKey)} />
                          <Tag
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              margin: 0,
                              fontSize: 10,
                              lineHeight: '14px',
                              padding: '0 4px',
                            }}
                            color={SELECTION_TIER_COLORS[it.tier]}
                          >
                            {SELECTION_TIER_LABELS[it.tier]}
                          </Tag>
                        </div>
                      ))}
                      {item.items.length > 12 && (
                        <Typography.Text type="secondary">+{item.items.length - 12}</Typography.Text>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            )}
            {submissionsTotal > submissions.length && (
              <Typography.Text type="secondary">仅显示最近 {submissions.length} 条</Typography.Text>
            )}
          </div>
        </Space>
      )}
    </Drawer>
  )
}

export default CosSelectionDrawer
