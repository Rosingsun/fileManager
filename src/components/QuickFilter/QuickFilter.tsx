import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Radio,
  Row,
  Select,
  Slider,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CopyOutlined,
  DeleteOutlined,
  ExportOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  FundProjectionScreenOutlined,
  InboxOutlined,
  StopOutlined,
  TagsOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import {
  DEFAULT_IMAGE_QUALITY_THRESHOLDS,
  type FileConflictAction,
  type ImageQualityFlag,
  type ImageQualityItemResult,
  type ImageQualityScanConfig,
  type ImageQualityScanProgress,
  type ImageQualityScanResult,
  type ImageQualityThresholds,
  type QuickFilterTier
} from '../../types'
import { ImageViewer, PageSection } from '../'
import {
  getElectronApiIssueMessage,
  getFileExtension,
  getQuickFilterOrganizeFolderName,
  imageLoader,
  suggestQuickFilterTier,
  waitForElectronApiReady
} from '../../utils'
import './QuickFilter.css'

function basename(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx >= 0 ? filePath.slice(idx + 1) : filePath
}

function joinPath(...parts: string[]): string {
  if (parts.length === 0) return ''
  const sep = parts[0].includes('\\') ? '\\' : '/'
  const normalized = parts.map((part, index) => {
    if (index === 0) return part.replace(/[\\/]+$/, '')
    return part.replace(/^[\\/]+|[\\/]+$/g, '')
  })
  return normalized.filter(Boolean).join(sep)
}

const { Paragraph } = Typography

type FilterChip = 'all' | ImageQualityFlag | 'composition'

const TIER_LABEL: Record<QuickFilterTier, string> = {
  high: '高',
  medium: '中',
  low: '低'
}

const TIER_DIR: Record<QuickFilterTier, string> = {
  high: '高',
  medium: '中',
  low: '低'
}

function hasCompositionFlag(flags: ImageQualityFlag[]): boolean {
  return flags.some(f =>
    f === 'subjectVeryCentered' || f === 'subjectOffThirds' || f === 'subjectNearEdge'
  )
}

const FLAG_LABEL: Record<ImageQualityFlag, string> = {
  overexposed: '过曝',
  underexposed: '欠曝',
  lowContrast: '低对比',
  subjectVeryCentered: '居中',
  subjectOffThirds: '偏离三分',
  subjectNearEdge: '贴边'
}

function removePathsFromScanResult(
  prev: ImageQualityScanResult | null,
  paths: Set<string>
): ImageQualityScanResult | null {
  if (!prev) return null
  return {
    ...prev,
    items: prev.items.filter(i => !paths.has(i.filePath))
  }
}

const QuickFilter: React.FC = () => {
  const [form] = Form.useForm()
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ImageQualityScanProgress | null>(null)
  const [result, setResult] = useState<ImageQualityScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chip, setChip] = useState<FilterChip>('all')
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map())
  const [apiHint, setApiHint] = useState<string | null>(null)
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
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewItems, setPreviewItems] = useState<ImageQualityItemResult[]>([])

  const changeChip = useCallback((c: FilterChip) => {
    setChip(c)
    setSelectedRowKeys([])
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ok = await waitForElectronApiReady({ requiredMethod: 'scanImageQuality' })
      if (cancelled) return
      if (!ok) {
        const msg = getElectronApiIssueMessage('scanImageQuality')
        setApiHint(msg || null)
      } else {
        setApiHint(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onImageQualityScanProgress) return
    const unsub = window.electronAPI.onImageQualityScanProgress(p => {
      setProgress(p)
      if (p.status === 'completed' || p.status === 'error' || p.status === 'cancelled') {
        setScanning(false)
      }
    })
    return unsub
  }, [])

  const loadThumbnails = useCallback(async (items: ImageQualityItemResult[]) => {
    const slice = items.slice(0, 100)
    const next = new Map<string, string>()
    for (const it of slice) {
      if (!it.ok) continue
      try {
        const r = await imageLoader.loadThumbnail(it.filePath, 120, 78, {
          useCache: true,
          timeout: 12000,
          retryCount: 1
        })
        if (r.data) next.set(it.filePath, r.data)
      } catch {
        /* skip */
      }
    }
    setThumbnails(next)
  }, [])

  useEffect(() => {
    if (result?.items?.length) {
      void loadThumbnails(result.items)
    } else {
      setThumbnails(new Map())
    }
  }, [result, loadThumbnails])

  useEffect(() => {
    if (!result?.items?.length) {
      setTierByPath({})
      return
    }
    const keep = new Set(result.items.map(i => i.filePath))
    setTierByPath(prev => {
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
    setSelectedRowKeys(keys => keys.filter(k => keep.has(String(k))))
  }, [result?.items])

  const filteredItems = useMemo(() => {
    if (!result?.items) return []
    if (chip === 'all') return result.items
    if (chip === 'composition') {
      return result.items.filter(r => hasCompositionFlag(r.flags))
    }
    return result.items.filter(r => r.flags.includes(chip))
  }, [result, chip])

  const handleOpenPreview = useCallback((item: ImageQualityItemResult) => {
    const list = filteredItems
    const idx = list.findIndex(i => i.filePath === item.filePath)
    if (idx < 0 || list.length === 0) {
      message.warning('当前列表中无可预览项')
      return
    }
    setPreviewItems(list)
    setPreviewIndex(idx)
    setPreviewOpen(true)
  }, [filteredItems])

  const itemByPath = useMemo(() => {
    const m = new Map<string, ImageQualityItemResult>()
    if (result?.items) {
      for (const it of result.items) m.set(it.filePath, it)
    }
    return m
  }, [result])

  const handleSelectPath = async () => {
    const ready = await waitForElectronApiReady({ requiredMethod: 'openDirectory' })
    if (!ready || !window.electronAPI) {
      setError(getElectronApiIssueMessage('openDirectory'))
      return
    }
    const path = await window.electronAPI.openDirectory()
    if (path) {
      form.setFieldsValue({ scanPath: path })
    }
  }

  const buildConfig = (values: Record<string, unknown>): ImageQualityScanConfig => {
    const th: ImageQualityThresholds = {
      highlightClipRatio: (values.highlightClipRatio as number) / 100,
      shadowClipRatio: (values.shadowClipRatio as number) / 100,
      lowContrastStd: values.lowContrastStd as number,
      overexposedMeanLuma: values.overexposedMeanLuma as number,
      underexposedMeanLuma: values.underexposedMeanLuma as number,
      compositionCenterEnergyRatio: (values.compositionCenterEnergyRatio as number) / 100,
      compositionCentroidOffThirdsMin: (values.compositionCentroidOffThirdsMin as number) / 100,
      compositionNearEdge: (values.compositionNearEdge as number) / 100
    }
    return {
      scanPath: values.scanPath as string,
      includeSubdirectories: (values.includeSubdirectories as boolean) ?? true,
      minFileSize: values.minFileSizeKb ? (values.minFileSizeKb as number) * 1024 : undefined,
      maxFileSize: values.maxFileSizeMb ? (values.maxFileSizeMb as number) * 1024 * 1024 : undefined,
      excludedFolders: values.excludedFolders
        ? String(values.excludedFolders)
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean)
        : [],
      excludedExtensions: values.excludedExtensions
        ? String(values.excludedExtensions)
            .split(',')
            .map(s => s.trim().replace('.', ''))
            .filter(Boolean)
        : [],
      analysisLongEdge: values.analysisLongEdge as number,
      maxConcurrent: values.maxConcurrent as number,
      thresholds: th
    }
  }

  const handleStart = async () => {
    const ready = await waitForElectronApiReady({ requiredMethod: 'scanImageQuality' })
    if (!ready) {
      setError(getElectronApiIssueMessage('scanImageQuality'))
      return
    }
    try {
      const values = await form.validateFields()
      setError(null)
      setResult(null)
      setProgress(null)
      setScanning(true)
      setChip('all')
      setSelectedRowKeys([])
      setTierByPath({})
      const config = buildConfig(values)
      const scanResult = await window.electronAPI.scanImageQuality(config)
      setResult(scanResult)
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) {
        setScanning(false)
        return
      }
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setScanning(false)
    }
  }

  const handleCancel = () => {
    window.electronAPI?.cancelImageQualityScan()
    setScanning(false)
    setProgress(p => (p ? { ...p, status: 'cancelled' } : p))
  }

  const setTierForPath = useCallback((filePath: string, tier: QuickFilterTier | null) => {
    setTierByPath(prev => {
      const next = { ...prev }
      if (tier === null) delete next[filePath]
      else next[filePath] = tier
      return next
    })
  }, [])

  const handleSuggestTiers = useCallback(() => {
    if (!result?.items.length) {
      message.warning('暂无扫描结果')
      return
    }
    const next: Partial<Record<string, QuickFilterTier>> = {}
    for (const it of result.items) {
      next[it.filePath] = suggestQuickFilterTier(it)
    }
    setTierByPath(next)
    message.success('已根据分析结果写入评级（可再手动调整）')
  }, [result])

  const handleSelectAllFiltered = () => {
    setSelectedRowKeys(filteredItems.map(i => i.filePath))
  }

  const handleClearSelection = () => {
    setSelectedRowKeys([])
  }

  const handleBulkDelete = () => {
    const keys = selectedRowKeys.map(String)
    if (keys.length === 0) {
      message.warning('请先选择要删除的行')
      return
    }
    Modal.confirm({
      title: '确认删除',
      content: `将永久删除选中的 ${keys.length} 个文件，此操作不可撤销。`,
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const api = window.electronAPI
        if (!api?.deleteFile) {
          message.error('Electron API 不可用')
          return
        }
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
          setResult(prev => removePathsFromScanResult(prev, new Set(successPaths)))
        }
        setSelectedRowKeys([])
        const ok = successPaths.length
        if (fail === 0) message.success(`已删除 ${ok} 个文件`)
        else message.warning(`删除完成：成功 ${ok}，失败 ${fail}`)
      }
    })
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
    const ok = results.filter(r => r.success).length
    const fail = results.length - ok
    setCopyModalOpen(false)
    if (fail === 0) message.success(`已复制 ${ok} 个文件到目标文件夹`)
    else message.warning(`复制完成：成功 ${ok}，失败 ${fail}`)
    if (copyRemoveAfter && ok > 0) {
      const removed = new Set(results.filter(r => r.success).map(r => r.filePath))
      setResult(prev => removePathsFromScanResult(prev, removed))
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
      .map(from => {
        const item = itemByPath.get(from)
        if (!item) return null
        const folder = getQuickFilterOrganizeFolderName(item)
        return { from, to: joinPath(root, folder, basename(from)) }
      })
      .filter(Boolean) as { from: string; to: string }[]
    const results = await window.electronAPI.batchRelocate(moves, flagOrgConflict)
    const okPaths = new Set(results.filter(r => r.success).map(r => r.filePath))
    setResult(prev => removePathsFromScanResult(prev, okPaths))
    setSelectedRowKeys([])
    setFlagOrgModalOpen(false)
    const ok = okPaths.size
    const fail = results.length - ok
    if (fail === 0) message.success(`已移动 ${ok} 个文件`)
    else message.warning(`移动完成：成功 ${ok}，失败 ${fail}`)
  }

  const runTierOrganize = async () => {
    const keys = selectedRowKeys.map(String)
    if (keys.length === 0) {
      message.warning('请先选择行')
      return
    }
    const unrated = keys.filter(k => tierByPath[k] === undefined)
    if (unrated.length > 0) {
      message.warning(`有 ${unrated.length} 项未设置评级，已跳过（仅移动已评级项）`)
    }
    const ratedKeys = keys.filter(k => tierByPath[k] !== undefined) as string[]
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
    const moves = ratedKeys.map(from => {
      const tier = tierByPath[from]!
      const dirName = TIER_DIR[tier]
      return { from, to: joinPath(root, dirName, basename(from)) }
    })
    const results = await window.electronAPI.batchRelocate(moves, tierOrgConflict)
    const okPaths = new Set(results.filter(r => r.success).map(r => r.filePath))
    setResult(prev => removePathsFromScanResult(prev, okPaths))
    setSelectedRowKeys([])
    setTierOrgModalOpen(false)
    const ok = okPaths.size
    const fail = results.length - ok
    if (fail === 0) message.success(`已按评级移动 ${ok} 个文件`)
    else message.warning(`移动完成：成功 ${ok}，失败 ${fail}`)
  }

  const handleExportCsv = () => {
    if (!result?.items.length) {
      message.warning('暂无数据可导出')
      return
    }
    const rows = result.items.map(it => {
      const tier = tierByPath[it.filePath]
      const tierText = tier ? TIER_LABEL[tier] : ''
      const flagsText = it.flags.map(f => FLAG_LABEL[f]).join(';')
      const folder = getQuickFilterOrganizeFolderName(it)
      const dim = it.width && it.height ? `${it.width}x${it.height}` : ''
      return [it.filePath, tierText, flagsText, folder, it.ok ? '是' : '否', dim]
    })
    const header = ['路径', '评级', '分析标记', '按标记整理子目录', '分析成功', '尺寸']
    const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`
    const body = [header, ...rows].map(cols => cols.map(escape).join(',')).join('\r\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `快速筛选导出_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('已导出 CSV')
  }

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
              className="quick-filter-thumb quick-filter-thumb--clickable"
              src={src}
              alt=""
              title="点击预览"
              onClick={() => handleOpenPreview(r)}
              role="presentation"
            />
          ) : (
            <div className="quick-filter-thumb" />
          )
        }
      },
      {
        title: '路径',
        dataIndex: 'filePath',
        ellipsis: true
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
              { value: 'low' as const, label: '低' }
            ]}
            onChange={(v: QuickFilterTier | null | undefined) =>
              setTierForPath(r.filePath, v === undefined || v === null ? null : v)
            }
          />
        )
      },
      {
        title: '尺寸',
        key: 'dim',
        width: 100,
        render: (_, r) => (r.width && r.height ? `${r.width}×${r.height}` : '—')
      },
      {
        title: '标记',
        key: 'flags',
        width: 200,
        render: (_, r) =>
          r.flags.length ? (
            <Space size={[4, 4]} wrap>
              {r.flags.map(f => (
                <Tag key={f} color="orange">
                  {FLAG_LABEL[f]}
                </Tag>
              ))}
            </Space>
          ) : (
            <Tag color="default">无</Tag>
          )
      },
      {
        title: '均值/标准差',
        key: 'stats',
        width: 120,
        render: (_, r) =>
          r.ok ? `${r.scores.meanLuma.toFixed(0)} / ${r.scores.lumaStd.toFixed(1)}` : '—'
      },
      {
        title: '操作',
        key: 'act',
        width: 140,
        render: (_, r) => (
          <Space>
            <Button type="link" size="small" onClick={() => handleOpenPreview(r)}>
              预览
            </Button>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => void navigator.clipboard.writeText(r.filePath)}
            >
              路径
            </Button>
          </Space>
        )
      }
    ],
    [thumbnails, tierByPath, setTierForPath, handleOpenPreview]
  )

  const progressPercent =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="quick-filter">
      <Card
        className="app-surface-card quick-filter-shell"
        title={
          <div className="quick-filter-shell__header">
            <div className="quick-filter-shell__title">
              <span className="quick-filter-shell__icon">
                <ThunderboltOutlined />
              </span>
              <div>
                <div className="quick-filter-shell__heading">快速筛选</div>
                <div className="quick-filter-shell__subheading">
                  曝光与对比度为量化参考；构图类为启发式提示，请结合人工判断
                </div>
              </div>
            </div>
            <Tag color="warning" bordered={false}>
              质量辅助
            </Tag>
          </div>
        }
        variant="borderless"
      >
        <div className="quick-filter-page">
          <Paragraph className="quick-filter-intro__text">
            基于缩略分析分辨率的亮度分布与梯度分布，批量标记可能过曝、欠曝、低对比度及构图相关提示。结果不代表审美结论。
          </Paragraph>

          {apiHint && (
            <Alert type="warning" showIcon message="无法使用快速筛选" description={apiHint} className="app-inline-notice" />
          )}

          {error && (
            <Alert
              type="error"
              showIcon
              closable
              message="扫描出错"
              description={error}
              onClose={() => setError(null)}
              className="app-inline-notice"
            />
          )}

          <Form
            form={form}
            layout="vertical"
            className="scan-config-form"
            initialValues={{
              includeSubdirectories: true,
              scanPath: '',
              minFileSizeKb: undefined,
              maxFileSizeMb: undefined,
              excludedFolders: '',
              excludedExtensions: '',
              analysisLongEdge: 640,
              maxConcurrent: 3,
              highlightClipRatio: Math.round(DEFAULT_IMAGE_QUALITY_THRESHOLDS.highlightClipRatio * 100),
              shadowClipRatio: Math.round(DEFAULT_IMAGE_QUALITY_THRESHOLDS.shadowClipRatio * 100),
              lowContrastStd: DEFAULT_IMAGE_QUALITY_THRESHOLDS.lowContrastStd,
              overexposedMeanLuma: DEFAULT_IMAGE_QUALITY_THRESHOLDS.overexposedMeanLuma,
              underexposedMeanLuma: DEFAULT_IMAGE_QUALITY_THRESHOLDS.underexposedMeanLuma,
              compositionCenterEnergyRatio: Math.round(
                DEFAULT_IMAGE_QUALITY_THRESHOLDS.compositionCenterEnergyRatio * 100
              ),
              compositionCentroidOffThirdsMin: Math.round(
                DEFAULT_IMAGE_QUALITY_THRESHOLDS.compositionCentroidOffThirdsMin * 100
              ),
              compositionNearEdge: Math.round(DEFAULT_IMAGE_QUALITY_THRESHOLDS.compositionNearEdge * 100)
            }}
          >
            <PageSection
              title="扫描范围"
              subtitle="选择文件夹与过滤条件"
              extra={
                <span className="similarity-section-hint">
                  <FolderOpenOutlined /> 目录
                </span>
              }
            >
              <Form.Item label="扫描路径" required>
                <div className="quick-filter-path-picker">
                  <Form.Item name="scanPath" rules={[{ required: true, message: '请选择文件夹' }]} noStyle>
                    <Input
                      readOnly
                      placeholder="选择要分析的文件夹"
                      onClick={handleSelectPath}
                      prefix={<FolderOpenOutlined />}
                    />
                  </Form.Item>
                  <Button type="primary" icon={<FolderOpenOutlined />} onClick={handleSelectPath}>
                    选择文件夹
                  </Button>
                </div>
              </Form.Item>
              <Space wrap size="large">
                <Form.Item label="包含子文件夹" name="includeSubdirectories" valuePropName="checked">
                  <Switch checkedChildren="是" unCheckedChildren="否" />
                </Form.Item>
                <Form.Item label="最小文件 (KB)" name="minFileSizeKb">
                  <InputNumber min={0} placeholder="可选" style={{ width: 140 }} />
                </Form.Item>
                <Form.Item label="最大文件 (MB)" name="maxFileSizeMb">
                  <InputNumber min={0} placeholder="可选" style={{ width: 140 }} />
                </Form.Item>
                <Form.Item label="分析长边 (px)" name="analysisLongEdge">
                  <InputNumber min={256} max={1024} style={{ width: 140 }} />
                </Form.Item>
                <Form.Item label="并行数" name="maxConcurrent">
                  <InputNumber min={1} max={8} style={{ width: 100 }} />
                </Form.Item>
              </Space>
              <Form.Item label="排除目录（每行一个绝对或相对路径）" name="excludedFolders">
                <Input.TextArea rows={2} placeholder="可选" />
              </Form.Item>
              <Form.Item label="排除扩展名（逗号分隔）" name="excludedExtensions">
                <Input placeholder="例如 raw, tif" />
              </Form.Item>
            </PageSection>

            <PageSection
              className="quick-filter-section-thresholds"
              title="阈值"
              subtitle="百分比类为 0–100 刻度；偏离默认越远，标记越敏感或越迟钝"
              extra={
                <span className="similarity-section-hint">
                  <FilterOutlined /> 参数
                </span>
              }
            >
              <Row gutter={[16, 12]}>
                <Col xs={24} sm={12} xl={8}>
                  <Form.Item
                    className="quick-filter-slider-item"
                    label={
                      <Tooltip title="高光区域（亮度≥250）像素占比超过此值则提示可能过曝">
                        <span>高光裁剪 ≥ (%)</span>
                      </Tooltip>
                    }
                    name="highlightClipRatio"
                  >
                    <Slider min={1} max={30} tooltip={{ formatter: v => `${v}%` }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} xl={8}>
                  <Form.Item
                    className="quick-filter-slider-item"
                    label={
                      <Tooltip title="暗部（亮度≤5）像素占比超过此值则提示可能欠曝">
                        <span>阴影裁剪 ≥ (%)</span>
                      </Tooltip>
                    }
                    name="shadowClipRatio"
                  >
                    <Slider min={1} max={30} tooltip={{ formatter: v => `${v}%` }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} xl={8}>
                  <Form.Item
                    className="quick-filter-slider-item"
                    label={
                      <Tooltip title="全图亮度标准差低于此值则提示低对比（发灰）">
                        <span>低对比阈值（标准差≤）</span>
                      </Tooltip>
                    }
                    name="lowContrastStd"
                  >
                    <Slider min={4} max={40} tooltip={{ formatter: v => String(v) }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} xl={8}>
                  <Form.Item
                    className="quick-filter-slider-item"
                    label={
                      <Tooltip title="平均亮度高于此值时辅助判断过曝">
                        <span>辅助过曝（均值≥）</span>
                      </Tooltip>
                    }
                    name="overexposedMeanLuma"
                  >
                    <Slider min={160} max={250} tooltip={{ formatter: v => String(v) }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} xl={8}>
                  <Form.Item
                    className="quick-filter-slider-item"
                    label={
                      <Tooltip title="平均亮度低于此值时辅助判断欠曝">
                        <span>辅助欠曝（均值≤）</span>
                      </Tooltip>
                    }
                    name="underexposedMeanLuma"
                  >
                    <Slider min={10} max={80} tooltip={{ formatter: v => String(v) }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} xl={8}>
                  <Form.Item
                    className="quick-filter-slider-item"
                    label={
                      <Tooltip title="中心九宫格内梯度能量占比，超过则提示主体可能过于居中">
                        <span>中心能量 ≥ (%)</span>
                      </Tooltip>
                    }
                    name="compositionCenterEnergyRatio"
                  >
                    <Slider min={35} max={80} tooltip={{ formatter: v => `${v}%` }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} xl={8}>
                  <Form.Item
                    className="quick-filter-slider-item"
                    label={
                      <Tooltip title="视觉重心到最近三分点的归一化距离，超过则提示偏离三分区">
                        <span>偏离三分区 ≥ (%)</span>
                      </Tooltip>
                    }
                    name="compositionCentroidOffThirdsMin"
                  >
                    <Slider min={10} max={45} tooltip={{ formatter: v => `${v}%` }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} xl={8}>
                  <Form.Item
                    className="quick-filter-slider-item"
                    label={
                      <Tooltip title="重心距画面边缘归一化距离小于此比例则提示贴近边缘">
                        <span>贴边判定（距边≤ %）</span>
                      </Tooltip>
                    }
                    name="compositionNearEdge"
                  >
                    <Slider min={4} max={20} tooltip={{ formatter: v => `${v}%` }} />
                  </Form.Item>
                </Col>
              </Row>
            </PageSection>

            <div className="quick-filter-action-buttons">
              <Button
                type="primary"
                icon={<FundProjectionScreenOutlined />}
                loading={scanning}
                disabled={Boolean(apiHint)}
                onClick={() => void handleStart()}
                size="large"
              >
                开始分析
              </Button>
              <Button 
                danger 
                icon={<StopOutlined />} 
                disabled={!scanning} 
                onClick={handleCancel}
                size="large"
              >
                取消
              </Button>
            </div>
          </Form>

          {scanning && progress && (
            <div className="quick-filter-progress">
              <Progress percent={progressPercent} status={progress.status === 'error' ? 'exception' : 'active'} />
              <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }} ellipsis>
                {progress.status === 'scanning' && '正在枚举图片…'}
                {progress.status === 'analyzing' && (progress.currentFile || '分析中…')}
                {progress.status === 'completed' && '已完成'}
                {progress.status === 'cancelled' && '已取消'}
                {progress.status === 'error' && '出错'}
              </Paragraph>
            </div>
          )}

          {result && (
            <PageSection
              title="结果"
              subtitle={`扫描 ${result.totalImages} 张，列表剩余 ${result.items.length} 项，跳过 ${result.skipped.length}，耗时 ${(result.scanTime / 1000).toFixed(1)} s`}
              extra={<ThunderboltOutlined />}
            >
              <div className="quick-filter-chip-row">
                <Tag.CheckableTag checked={chip === 'all'} onChange={c => c && changeChip('all')}>
                  全部
                </Tag.CheckableTag>
                <Tag.CheckableTag checked={chip === 'overexposed'} onChange={c => c && changeChip('overexposed')}>
                  过曝
                </Tag.CheckableTag>
                <Tag.CheckableTag checked={chip === 'underexposed'} onChange={c => c && changeChip('underexposed')}>
                  欠曝
                </Tag.CheckableTag>
                <Tag.CheckableTag checked={chip === 'lowContrast'} onChange={c => c && changeChip('lowContrast')}>
                  低对比
                </Tag.CheckableTag>
                <Tag.CheckableTag checked={chip === 'composition'} onChange={c => c && changeChip('composition')}>
                  构图提示
                </Tag.CheckableTag>
              </div>
              {result.skipped.length > 0 && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={`已跳过 ${result.skipped.length} 个文件`}
                  description={result.skipped.slice(0, 5).map(s => `${s.path}: ${s.reason}`).join('\n')}
                />
              )}

              <div className="quick-filter-results-toolbar">
                <Space wrap size={[8, 8]} align="center">
                  <Typography.Text type="secondary">已选 {selectedRowKeys.length} 项</Typography.Text>
                  <Button size="small" onClick={handleSelectAllFiltered}>
                    全选当前列表
                  </Button>
                  <Button size="small" onClick={handleClearSelection}>
                    取消选择
                  </Button>
                  <Tooltip title="根据曝光/对比/构图启发式写入「高/中/低」，仅供参考">
                    <Button size="small" onClick={handleSuggestTiers}>
                      按分析初分评级
                    </Button>
                  </Tooltip>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => void handleOpenCopyModal()}>
                    复制到…
                  </Button>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={handleBulkDelete}>
                    删除所选
                  </Button>
                  <Button size="small" icon={<TagsOutlined />} onClick={() => setFlagOrgModalOpen(true)}>
                    按标记整理…
                  </Button>
                  <Button size="small" icon={<InboxOutlined />} onClick={() => setTierOrgModalOpen(true)}>
                    按评级整理…
                  </Button>
                  <Button size="small" icon={<ExportOutlined />} onClick={handleExportCsv}>
                    导出 CSV
                  </Button>
                </Space>
              </div>

              <div className="quick-filter-results">
                <Table<ImageQualityItemResult>
                  rowKey="filePath"
                  size="small"
                  pagination={{ pageSize: 25 }}
                  scroll={{ x: 1180 }}
                  rowSelection={{
                    selectedRowKeys,
                    onChange: keys => setSelectedRowKeys(keys)
                  }}
                  columns={columns}
                  dataSource={filteredItems}
                  expandable={{
                    expandedRowRender: r => (
                      <div>
                        {!r.ok && r.error && <Alert type="warning" message={r.error} />}
                        {r.compositionHints.map((h, i) => (
                          <div key={i}>{h}</div>
                        ))}
                        {r.ok && (
                          <Typography.Text type="secondary">
                            高光占比 {(r.scores.highlightClipRatio * 100).toFixed(2)}%，阴影占比{' '}
                            {(r.scores.shadowClipRatio * 100).toFixed(2)}%，九宫格熵 {r.scores.gridEntropy.toFixed(2)}
                          </Typography.Text>
                        )}
                      </div>
                    ),
                    rowExpandable: r => Boolean(r.compositionHints.length || !r.ok)
                  }}
                />
              </div>
            </PageSection>
          )}
        </div>
      </Card>

      <Modal
        title="复制到文件夹"
        open={copyModalOpen}
        onCancel={() => setCopyModalOpen(false)}
        onOk={() => void runCopy()}
        okText="开始复制"
        destroyOnClose
      >
        <Paragraph ellipsis={{ rows: 2 }} type="secondary">
          目标：{copyDestDir}
        </Paragraph>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>重名时</Typography.Text>
          <Radio.Group value={copyConflict} onChange={e => setCopyConflict(e.target.value)}>
            <Radio value="rename">自动重命名</Radio>
            <Radio value="skip">跳过</Radio>
            <Radio value="overwrite">覆盖</Radio>
          </Radio.Group>
          <Checkbox checked={copyRemoveAfter} onChange={e => setCopyRemoveAfter(e.target.checked)}>
            成功后从当前结果列表移除
          </Checkbox>
        </Space>
      </Modal>

      <Modal
        title="按标记整理（移动文件）"
        open={flagOrgModalOpen}
        onCancel={() => setFlagOrgModalOpen(false)}
        onOk={() => void runFlagOrganize()}
        okText="选择根目录并移动"
        destroyOnClose
      >
        <Paragraph type="secondary">
          将把选中文件移动到您选择的根目录下的子文件夹（过曝、欠曝、低对比、构图提示、未标记、曝光矛盾、分析失败等）。原路径不再保留。
        </Paragraph>
        <Typography.Text>重名时</Typography.Text>
        <Radio.Group value={flagOrgConflict} onChange={e => setFlagOrgConflict(e.target.value)} style={{ marginTop: 8 }}>
          <Radio value="rename">自动重命名</Radio>
          <Radio value="skip">跳过</Radio>
          <Radio value="overwrite">覆盖</Radio>
        </Radio.Group>
      </Modal>

      <Modal
        title="按评级整理（移动文件）"
        open={tierOrgModalOpen}
        onCancel={() => setTierOrgModalOpen(false)}
        onOk={() => void runTierOrganize()}
        okText="选择根目录并移动"
        destroyOnClose
      >
        <Paragraph type="secondary">
          仅移动已设置「高/中/低」评级的选中项到根目录下的「高」「中」「低」子文件夹。未评级项将跳过。
        </Paragraph>
        <Radio.Group value={tierOrgConflict} onChange={e => setTierOrgConflict(e.target.value)}>
          <Radio value="rename">自动重命名</Radio>
          <Radio value="skip">跳过</Radio>
          <Radio value="overwrite">覆盖</Radio>
        </Radio.Group>
      </Modal>

      {previewOpen && previewItems.length > 0 && (
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
              modifiedAt: ''
            }
          })}
          currentIndex={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}

export default QuickFilter
