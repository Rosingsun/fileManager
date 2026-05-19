import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Dropdown,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import {
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  ExportOutlined,
  InboxOutlined,
  ReloadOutlined,
  TagsOutlined,
} from '@ant-design/icons'
import type {
  FileConflictAction,
  ImageQualityItemResult,
  ImageQualityScanConfig,
  ImageQualityScanResult,
  QuickFilterTier,
} from '../../types'
import { ImageViewer } from '../'
import { Button } from '../ui/button'
import {
  getElectronApiIssueMessage,
  getFileExtension,
  getQuickFilterOrganizeFolderName,
  imageLoader,
  logSignedInUserAction,
  suggestQuickFilterTier,
  waitForElectronApiReady,
} from '../../utils'
import { QuickFilterCopyDialog, QuickFilterDeleteDialog, QuickFilterOrganizeDialog } from './QuickFilterBulkDialogs'
import {
  FILTER_CHIPS,
  FLAG_LABEL,
  TIER_DIR,
  TIER_LABEL,
  basename,
  countByChip,
  filterItemsByChip,
  joinPath,
  removePathsFromScanResult,
  type FilterChip,
} from './quickFilterShared'

interface QuickFilterResultsViewProps {
  result: ImageQualityScanResult
  config: ImageQualityScanConfig
  onReset: () => void
  onResultChange: (result: ImageQualityScanResult | null) => void
}

const QuickFilterResultsView: React.FC<QuickFilterResultsViewProps> = ({
  result,
  config: _config,
  onReset,
  onResultChange,
}) => {
  const [chip, setChip] = useState<FilterChip>('all')
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map())
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [tierByPath, setTierByPath] = useState<Partial<Record<string, QuickFilterTier>>>({})
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copyDestDir, setCopyDestDir] = useState('')
  const [copyConflict, setCopyConflict] = useState<FileConflictAction>('rename')
  const [copyRemoveAfter, setCopyRemoveAfter] = useState(false)
  const [flagOrgModalOpen, setFlagOrgModalOpen] = useState(false)
  const [flagOrgConflict, setFlagOrgConflict] = useState<FileConflictAction>('rename')
  const [tierOrgModalOpen, setTierOrgModalOpen] = useState(false)
  const [tierOrgConflict, setTierOrgConflict] = useState<FileConflictAction>('rename')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewItems, setPreviewItems] = useState<ImageQualityItemResult[]>([])

  const changeChip = useCallback((c: FilterChip) => {
    setChip(c)
    setSelectedRowKeys([])
  }, [])

  const filteredItems = useMemo(
    () => filterItemsByChip(result.items, chip),
    [result.items, chip]
  )

  const flagCounts = useMemo(() => countByChip(result.items), [result.items])

  const itemByPath = useMemo(() => {
    const m = new Map<string, ImageQualityItemResult>()
    for (const it of result.items) m.set(it.filePath, it)
    return m
  }, [result.items])

  const loadThumbnails = useCallback(async (items: ImageQualityItemResult[]) => {
    const paths = items.filter((it) => it.ok).slice(0, 120).map((it) => it.filePath)
    if (paths.length === 0) {
      setThumbnails(new Map())
      return
    }
    try {
      await imageLoader.preloadBatch(paths, 'thumbnail', 4)
    } catch {
      /* continue with individual loads */
    }
    const next = new Map<string, string>()
    await Promise.allSettled(
      paths.map(async (filePath) => {
        try {
          const r = await imageLoader.loadThumbnail(filePath, 120, 78, {
            useCache: true,
            timeout: 12000,
            retryCount: 1,
          })
          if (r.data) next.set(filePath, r.data)
        } catch {
          /* skip */
        }
      })
    )
    setThumbnails(next)
  }, [])

  useEffect(() => {
    void loadThumbnails(filteredItems)
  }, [filteredItems, loadThumbnails])

  useEffect(() => {
    const keep = new Set(result.items.map((i) => i.filePath))
    setTierByPath((prev) => {
      let changed = false
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        if (!keep.has(k)) {
          delete next[k]
          changed = true
        }
      }
      return changed ? next : prev
    })
    setSelectedRowKeys((keys) => keys.filter((k) => keep.has(String(k))))
  }, [result.items])

  const setTierForPath = useCallback((filePath: string, tier: QuickFilterTier | null) => {
    setTierByPath((prev) => {
      const next = { ...prev }
      if (tier === null) delete next[filePath]
      else next[filePath] = tier
      return next
    })
  }, [])

  const handleOpenPreview = useCallback(
    (item: ImageQualityItemResult) => {
      const idx = filteredItems.findIndex((i) => i.filePath === item.filePath)
      if (idx < 0 || filteredItems.length === 0) {
        message.warning('当前列表中无可预览项')
        return
      }
      setPreviewItems(filteredItems)
      setPreviewIndex(idx)
      setPreviewOpen(true)
    },
    [filteredItems]
  )

  const handleSuggestTiers = useCallback(() => {
    if (!result.items.length) {
      message.warning('暂无扫描结果')
      return
    }
    const next: Partial<Record<string, QuickFilterTier>> = {}
    for (const it of result.items) {
      next[it.filePath] = suggestQuickFilterTier(it)
    }
    setTierByPath(next)
    message.success('已根据分析结果写入评级（可再手动调整）')
    logSignedInUserAction('quick_filter_tier_write', '快速筛选：一键写入建议评级')
  }, [result.items])

  const handleExportCsv = () => {
    if (!result.items.length) {
      message.warning('暂无数据可导出')
      return
    }
    const rows = result.items.map((it) => {
      const tier = tierByPath[it.filePath]
      const tierText = tier ? TIER_LABEL[tier] : ''
      const flagsText = it.flags.map((f) => FLAG_LABEL[f]).join(';')
      const folder = getQuickFilterOrganizeFolderName(it)
      const dim = it.width && it.height ? `${it.width}x${it.height}` : ''
      return [it.filePath, tierText, flagsText, folder, it.ok ? '是' : '否', dim]
    })
    const header = ['路径', '评级', '分析标记', '按标记整理子目录', '分析成功', '尺寸']
    const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`
    const body = [header, ...rows].map((cols) => cols.map(escape).join(',')).join('\r\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `快速筛选导出_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('已导出 CSV')
    logSignedInUserAction('quick_filter_export_csv', '快速筛选导出 CSV')
  }

  const handleOpenCopyModal = async () => {
    const keys = selectedRowKeys.map(String)
    if (keys.length === 0) {
      message.warning('请先选择要复制的行')
      return
    }
    const ready = await waitForElectronApiReady({ requiredMethod: 'batchCopyToDirectory' })
    if (!ready || !window.electronAPI?.batchCopyToDirectory) {
      message.error(getElectronApiIssueMessage('batchCopyToDirectory'))
      return
    }
    const dir = await window.electronAPI.openDirectory()
    if (!dir) return
    setCopyDestDir(dir)
    setCopyConflict('rename')
    setCopyRemoveAfter(false)
    setCopyModalOpen(true)
  }

  const runCopy = async () => {
    const keys = selectedRowKeys.map(String)
    const api = window.electronAPI
    if (!api?.batchCopyToDirectory || !copyDestDir) return
    const results = await api.batchCopyToDirectory(keys, copyDestDir, copyConflict)
    const ok = results.filter((r) => r.success).length
    const fail = results.length - ok
    setCopyModalOpen(false)
    if (fail === 0) message.success(`已复制 ${ok} 个文件到目标文件夹`)
    else message.warning(`复制完成：成功 ${ok}，失败 ${fail}`)
    logSignedInUserAction('file_batch_copy', `快速筛选复制到目录（成功 ${ok}，失败 ${fail}）`, copyDestDir)
    if (copyRemoveAfter && ok > 0) {
      const removed = new Set(results.filter((r) => r.success).map((r) => r.filePath))
      onResultChange(removePathsFromScanResult(result, removed))
      setSelectedRowKeys([])
    }
  }

  const runFlagOrganize = async () => {
    const keys = selectedRowKeys.map(String)
    if (keys.length === 0) {
      message.warning('请先选择行')
      return
    }
    const ready = await waitForElectronApiReady({ requiredMethod: 'batchRelocate' })
    if (!ready || !window.electronAPI?.batchRelocate) {
      message.error(getElectronApiIssueMessage('batchRelocate'))
      return
    }
    const root = await window.electronAPI.openDirectory()
    if (!root) return
    const moves = keys
      .map((from) => {
        const item = itemByPath.get(from)
        if (!item) return null
        const folder = getQuickFilterOrganizeFolderName(item)
        return { from, to: joinPath(root, folder, basename(from)) }
      })
      .filter(Boolean) as { from: string; to: string }[]
    const results = await window.electronAPI.batchRelocate(moves, flagOrgConflict)
    const okPaths = new Set(results.filter((r) => r.success).map((r) => r.filePath))
    onResultChange(removePathsFromScanResult(result, okPaths))
    setSelectedRowKeys([])
    setFlagOrgModalOpen(false)
    const ok = okPaths.size
    const fail = results.length - ok
    if (fail === 0) message.success(`已移动 ${ok} 个文件`)
    else message.warning(`移动完成：成功 ${ok}，失败 ${fail}`)
    logSignedInUserAction('file_batch_relocate', `快速筛选按标记整理（成功 ${ok}，失败 ${fail}）`)
  }

  const runTierOrganize = async () => {
    const keys = selectedRowKeys.map(String)
    if (keys.length === 0) {
      message.warning('请先选择行')
      return
    }
    const unrated = keys.filter((k) => tierByPath[k] === undefined)
    if (unrated.length > 0) {
      message.warning(`有 ${unrated.length} 项未设置评级，已跳过（仅移动已评级项）`)
    }
    const ratedKeys = keys.filter((k) => tierByPath[k] !== undefined) as string[]
    if (ratedKeys.length === 0) {
      message.warning('所选行中没有已评级项')
      return
    }
    const ready = await waitForElectronApiReady({ requiredMethod: 'batchRelocate' })
    if (!ready || !window.electronAPI?.batchRelocate) {
      message.error(getElectronApiIssueMessage('batchRelocate'))
      return
    }
    const root = await window.electronAPI.openDirectory()
    if (!root) return
    const moves = ratedKeys.map((from) => {
      const tier = tierByPath[from]!
      const dirName = TIER_DIR[tier]
      return { from, to: joinPath(root, dirName, basename(from)) }
    })
    const results = await window.electronAPI.batchRelocate(moves, tierOrgConflict)
    const okPaths = new Set(results.filter((r) => r.success).map((r) => r.filePath))
    onResultChange(removePathsFromScanResult(result, okPaths))
    setSelectedRowKeys([])
    setTierOrgModalOpen(false)
    const ok = okPaths.size
    const fail = results.length - ok
    if (fail === 0) message.success(`已按评级移动 ${ok} 个文件`)
    else message.warning(`移动完成：成功 ${ok}，失败 ${fail}`)
    logSignedInUserAction('file_batch_relocate', `快速筛选按评级整理（成功 ${ok}，失败 ${fail}）`)
  }

  const handleConfirmDelete = async () => {
    const keys = selectedRowKeys.map(String)
    const api = window.electronAPI
    if (!api?.deleteFile) {
      message.error('Electron API 不可用')
      return
    }
    setDeleting(true)
    const successPaths: string[] = []
    let fail = 0
    for (const p of keys) {
      try {
        const r = await api.deleteFile(p)
        if (r) successPaths.push(p)
        else fail += 1
      } catch {
        fail += 1
      }
    }
    if (successPaths.length > 0) {
      onResultChange(removePathsFromScanResult(result, new Set(successPaths)))
    }
    setSelectedRowKeys([])
    setDeleteDialogOpen(false)
    setDeleting(false)
    const ok = successPaths.length
    if (fail === 0) message.success(`已删除 ${ok} 个文件`)
    else message.warning(`删除完成：成功 ${ok}，失败 ${fail}`)
    if (ok > 0) logSignedInUserAction('quick_filter_bulk_delete', `快速筛选批量删除（成功 ${ok}，失败 ${fail}）`)
  }

  const organizeMenuItems: MenuProps['items'] = [
    { key: 'copy', icon: <CopyOutlined />, label: '复制到…', onClick: () => void handleOpenCopyModal() },
    { key: 'flag', icon: <TagsOutlined />, label: '按标记整理…', onClick: () => setFlagOrgModalOpen(true) },
    { key: 'tier', icon: <InboxOutlined />, label: '按评级整理…', onClick: () => setTierOrgModalOpen(true) },
  ]

  const moreMenuItems: MenuProps['items'] = [
    { key: 'export', icon: <ExportOutlined />, label: '导出 CSV', onClick: handleExportCsv },
  ]

  const columns: ColumnsType<ImageQualityItemResult> = useMemo(
    () => [
      {
        title: '预览',
        dataIndex: 'filePath',
        width: 76,
        render: (_p: string, r) => {
          const src = thumbnails.get(r.filePath)
          return src ? (
            <img
              className="qf-thumb qf-thumb--clickable"
              src={src}
              alt=""
              title="点击预览"
              onClick={() => handleOpenPreview(r)}
              role="presentation"
            />
          ) : (
            <div className="qf-thumb" />
          )
        },
      },
      {
        title: '文件名',
        dataIndex: 'filePath',
        ellipsis: true,
        render: (path: string) => (
          <Tooltip title={path}>
            <span>{basename(path)}</span>
          </Tooltip>
        ),
      },
      {
        title: '评级',
        key: 'tier',
        width: 108,
        render: (_, r) => (
          <Select
            size="small"
            allowClear
            placeholder="未评"
            value={tierByPath[r.filePath]}
            style={{ width: '100%' }}
            options={[
              { value: 'high' as const, label: '高' },
              { value: 'medium' as const, label: '中' },
              { value: 'low' as const, label: '低' },
            ]}
            onChange={(v: QuickFilterTier | null | undefined) =>
              setTierForPath(r.filePath, v === undefined || v === null ? null : v)
            }
          />
        ),
      },
      {
        title: '标记',
        key: 'flags',
        width: 180,
        render: (_, r) =>
          r.flags.length ? (
            <Space size={[4, 4]} wrap>
              {r.flags.map((f) => (
                <Tag key={f} color="orange">
                  {FLAG_LABEL[f]}
                </Tag>
              ))}
            </Space>
          ) : (
            <Tag color="default">无</Tag>
          ),
      },
      {
        title: '尺寸',
        key: 'dim',
        width: 100,
        render: (_, r) => (r.width && r.height ? `${r.width}×${r.height}` : '—'),
      },
      {
        title: '操作',
        key: 'act',
        width: 80,
        render: (_, r) => (
          <Button type="button" variant="link" size="sm" onClick={() => handleOpenPreview(r)}>
            预览
          </Button>
        ),
      },
    ],
    [thumbnails, tierByPath, setTierForPath, handleOpenPreview]
  )

  return (
    <section className="qf-results">
      <div className="qf-stats">
        <div className="qf-stat">
          <span className="qf-stat__value">{result.totalImages}</span>
          <span className="qf-stat__label">扫描总数</span>
        </div>
        <div className="qf-stat">
          <span className="qf-stat__value">{result.items.length}</span>
          <span className="qf-stat__label">列表剩余</span>
        </div>
        <div className="qf-stat">
          <span className="qf-stat__value">{result.skipped.length}</span>
          <span className="qf-stat__label">已跳过</span>
        </div>
        <div className="qf-stat">
          <span className="qf-stat__value">{(result.scanTime / 1000).toFixed(1)}s</span>
          <span className="qf-stat__label">耗时</span>
        </div>
      </div>

      <div className="qf-chips" role="tablist" aria-label="结果筛选">
        {FILTER_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={chip === c.key}
            className={`qf-chip ${chip === c.key ? 'is-active' : ''}`}
            onClick={() => changeChip(c.key)}
          >
            {c.label}
            <span className="qf-chip__count">{flagCounts[c.key]}</span>
          </button>
        ))}
      </div>

      {result.skipped.length > 0 ? (
        <Alert
          type="info"
          showIcon
          message={`已跳过 ${result.skipped.length} 个文件`}
          description={result.skipped.slice(0, 5).map((s) => `${s.path}: ${s.reason}`).join('\n')}
        />
      ) : null}

      <div className="qf-toolbar">
        <div className="qf-toolbar__group">
          <span className="qf-toolbar__meta">已选 {selectedRowKeys.length} 项</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedRowKeys(filteredItems.map((i) => i.filePath))}>
            全选当前列表
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedRowKeys([])}>
            取消选择
          </Button>
        </div>
        <div className="qf-toolbar__group">
          <Tooltip title="根据曝光/对比/构图启发式写入「高/中/低」，仅供参考">
            <Button type="button" variant="default" size="sm" onClick={handleSuggestTiers}>
              按分析初分评级
            </Button>
          </Tooltip>
          <Dropdown menu={{ items: organizeMenuItems }} trigger={['click']}>
            <Button type="button" variant="outline" size="sm">
              整理 <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
            <Button type="button" variant="outline" size="sm">
              更多 <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={selectedRowKeys.length === 0}
            onClick={() => setDeleteDialogOpen(true)}
          >
            <DeleteOutlined /> 删除所选
          </Button>
        </div>
      </div>

      <div className="qf-table-wrap">
        <Table<ImageQualityItemResult>
          rowKey="filePath"
          size="small"
          pagination={{ pageSize: 25 }}
          scroll={{ x: 900 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          columns={columns}
          dataSource={filteredItems}
          expandable={{
            expandedRowRender: (r) => (
              <div>
                {!r.ok && r.error ? <Alert type="warning" message={r.error} /> : null}
                {r.compositionHints.map((h, i) => (
                  <div key={i}>{h}</div>
                ))}
                {r.ok ? (
                  <Typography.Text type="secondary">
                    高光 {(r.scores.highlightClipRatio * 100).toFixed(1)}%，阴影{' '}
                    {(r.scores.shadowClipRatio * 100).toFixed(1)}%，清晰度{' '}
                    {r.scores.sharpnessLapMean.toFixed(1)}，噪点 {r.scores.noiseLevel.toFixed(1)}，色偏{' '}
                    {(r.scores.colorCastScore * 100).toFixed(1)}%
                  </Typography.Text>
                ) : null}
              </div>
            ),
            rowExpandable: (r) => Boolean(r.compositionHints.length || !r.ok),
          }}
        />
      </div>

      <div className="qf-results-footer">
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          <ReloadOutlined /> 重新扫描
        </Button>
      </div>

      <QuickFilterCopyDialog
        open={copyModalOpen}
        destDir={copyDestDir}
        conflict={copyConflict}
        removeAfter={copyRemoveAfter}
        onConflictChange={setCopyConflict}
        onRemoveAfterChange={setCopyRemoveAfter}
        onCancel={() => setCopyModalOpen(false)}
        onConfirm={() => void runCopy()}
      />

      <QuickFilterOrganizeDialog
        open={flagOrgModalOpen}
        title="按标记整理（移动文件）"
        description="将把选中文件移动到您选择的根目录下的子文件夹（过曝、欠曝、低对比、构图提示等）。原路径不再保留。"
        conflict={flagOrgConflict}
        confirmLabel="选择根目录并移动"
        onConflictChange={setFlagOrgConflict}
        onCancel={() => setFlagOrgModalOpen(false)}
        onConfirm={() => void runFlagOrganize()}
      />

      <QuickFilterOrganizeDialog
        open={tierOrgModalOpen}
        title="按评级整理（移动文件）"
        description="仅移动已设置「高/中/低」评级的选中项到对应子文件夹。未评级项将跳过。"
        conflict={tierOrgConflict}
        confirmLabel="选择根目录并移动"
        onConflictChange={setTierOrgConflict}
        onCancel={() => setTierOrgModalOpen(false)}
        onConfirm={() => void runTierOrganize()}
      />

      <QuickFilterDeleteDialog
        open={deleteDialogOpen}
        count={selectedRowKeys.length}
        deleting={deleting}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => void handleConfirmDelete()}
      />

      {previewOpen && previewItems.length > 0 ? (
        <ImageViewer
          images={previewItems.map((item, index) => {
            const name = basename(item.filePath)
            return {
              id: `${index}-${item.filePath}`,
              url: `file://${item.filePath}`,
              filePath: item.filePath,
              filename: name,
              width: item.width ?? 0,
              height: item.height ?? 0,
              size: 0,
              format: getFileExtension(name || 'jpg'),
              createdAt: '',
              modifiedAt: '',
            }
          })}
          currentIndex={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </section>
  )
}

export default QuickFilterResultsView
