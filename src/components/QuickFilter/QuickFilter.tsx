import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Progress,
  Row,
  Slider,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CopyOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  FundProjectionScreenOutlined,
  StopOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import {
  DEFAULT_IMAGE_QUALITY_THRESHOLDS,
  type ImageQualityFlag,
  type ImageQualityItemResult,
  type ImageQualityScanConfig,
  type ImageQualityScanProgress,
  type ImageQualityScanResult,
  type ImageQualityThresholds
} from '../../types'
import { PageSection } from '../UnifiedUI'
import { getElectronApiIssueMessage, imageLoader, waitForElectronApiReady } from '../../utils'
import './QuickFilter.css'

const { Paragraph } = Typography

type FilterChip = 'all' | ImageQualityFlag | 'composition'

function hasCompositionFlag(flags: ImageQualityFlag[]): boolean {
  return flags.some(f =>
    f === 'subjectVeryCentered' || f === 'subjectOffThirds' || f === 'subjectNearEdge'
  )
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

  const filteredItems = useMemo(() => {
    if (!result?.items) return []
    if (chip === 'all') return result.items
    if (chip === 'composition') {
      return result.items.filter(r => hasCompositionFlag(r.flags))
    }
    return result.items.filter(r => r.flags.includes(chip))
  }, [result, chip])

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

  const flagLabel: Record<ImageQualityFlag, string> = {
    overexposed: '过曝',
    underexposed: '欠曝',
    lowContrast: '低对比',
    subjectVeryCentered: '居中',
    subjectOffThirds: '偏离三分',
    subjectNearEdge: '贴边'
  }

  const columns: ColumnsType<ImageQualityItemResult> = useMemo(
    () => [
      {
        title: '预览',
        dataIndex: 'filePath',
        width: 76,
        render: (p: string) => {
          const src = thumbnails.get(p)
          return src ? (
            <img className="quick-filter-thumb" src={src} alt="" />
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
        title: '尺寸',
        key: 'dim',
        width: 100,
        render: (_, r) => (r.width && r.height ? `${r.width}×${r.height}` : '—')
      },
      {
        title: '标记',
        key: 'flags',
        width: 220,
        render: (_, r) =>
          r.flags.length ? (
            <Space size={[4, 4]} wrap>
              {r.flags.map(f => (
                <Tag key={f} color="orange">
                  {flagLabel[f]}
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
            <Button type="link" size="small" onClick={() => window.electronAPI?.openFile(r.filePath)}>
              打开
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
    [thumbnails]
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

            <Space>
              <Button
                type="primary"
                icon={<FundProjectionScreenOutlined />}
                loading={scanning}
                disabled={Boolean(apiHint)}
                onClick={() => void handleStart()}
              >
                开始分析
              </Button>
              <Button danger icon={<StopOutlined />} disabled={!scanning} onClick={handleCancel}>
                取消
              </Button>
            </Space>
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
              subtitle={`共 ${result.totalImages} 张，跳过 ${result.skipped.length}，耗时 ${(result.scanTime / 1000).toFixed(1)} s`}
              extra={<ThunderboltOutlined />}
            >
              <div className="quick-filter-chip-row">
                <Tag.CheckableTag checked={chip === 'all'} onChange={c => c && setChip('all')}>
                  全部
                </Tag.CheckableTag>
                <Tag.CheckableTag checked={chip === 'overexposed'} onChange={c => c && setChip('overexposed')}>
                  过曝
                </Tag.CheckableTag>
                <Tag.CheckableTag checked={chip === 'underexposed'} onChange={c => c && setChip('underexposed')}>
                  欠曝
                </Tag.CheckableTag>
                <Tag.CheckableTag checked={chip === 'lowContrast'} onChange={c => c && setChip('lowContrast')}>
                  低对比
                </Tag.CheckableTag>
                <Tag.CheckableTag checked={chip === 'composition'} onChange={c => c && setChip('composition')}>
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
              <div className="quick-filter-results">
                <Table<ImageQualityItemResult>
                  rowKey="filePath"
                  size="small"
                  pagination={{ pageSize: 25 }}
                  scroll={{ x: 900 }}
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
    </div>
  )
}

export default QuickFilter
