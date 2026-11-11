import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  Select,
  Slider,
  InputNumber,
  Radio,
  Button,
  Space,
  Spin,
  Typography,
  App,
  ConfigProvider,
  Progress,
} from 'antd'
import type { BatchOperationResult, ImageEditSettings } from '../../types'
import { TbFolderOpen } from '../icons'
import {
  basenameFromPath,
  buildEditorExportOptions,
  defaultTargetFormatFromPath,
  formatByteSize,
  getParentDir,
  listSiblingImagesForExport,
  logSignedInUserAction,
  truncatePathForDisplay,
  type EditorExportOverwriteMode,
} from '../../utils'

const { Text } = Typography

const FORMAT_OPTIONS = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'bmp', label: 'BMP' },
  { value: 'tiff', label: 'TIFF' },
]

const PREVIEW_DEBOUNCE_MS = 300

/** 高于 .image-editor-shell (1100) 与编辑器内弹出层 (1200) */
const EDITOR_EXPORT_MODAL_Z_INDEX = 1300
const EDITOR_EXPORT_POPUP_Z_INDEX_BASE = 1310

type OutputDestMode = 'source_dir' | 'custom_dir'

interface ExportProgressState {
  current: number
  total: number
  fileName: string
}

interface EditorExportDialogProps {
  open: boolean
  filePath: string
  editSettings: ImageEditSettings
  onClose: () => void
  onSuccess: (result: { filePath: string; batch?: boolean }) => void
}

const EditorExportDialog: React.FC<EditorExportDialogProps> = ({
  open,
  filePath,
  editSettings,
  onClose,
  onSuccess,
}) => {
  const { message, modal } = App.useApp()
  const [targetFormat, setTargetFormat] = useState('jpeg')
  const [quality, setQuality] = useState(85)
  const [overwriteMode, setOverwriteMode] = useState<EditorExportOverwriteMode>('new_file')
  const [outputDestMode, setOutputDestMode] = useState<OutputDestMode>('source_dir')
  const [outputDir, setOutputDir] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewSize, setPreviewSize] = useState(0)
  const [previewDims, setPreviewDims] = useState({ width: 0, height: 0 })
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<ExportProgressState | null>(null)
  const [siblingPaths, setSiblingPaths] = useState<string[]>([])
  const [siblingsLoading, setSiblingsLoading] = useState(false)
  const previewGenRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sourceDir = useMemo(() => getParentDir(filePath), [filePath])

  const sourceExt = useMemo(() => {
    const m = filePath.match(/\.([a-zA-Z0-9]+)$/i)
    return m ? m[1].toLowerCase() : ''
  }, [filePath])

  const targetExtHint = useMemo(() => {
    if (targetFormat === 'jpeg') return 'jpg'
    if (targetFormat === 'tiff') return 'tif'
    return targetFormat
  }, [targetFormat])

  const formatChangedOnOverwrite =
    overwriteMode === 'overwrite' &&
    sourceExt &&
    !['jpg', 'jpeg'].includes(sourceExt) &&
    !['jpg', 'jpeg'].includes(targetExtHint) &&
    sourceExt !== targetExtHint &&
    !(sourceExt === 'tif' && targetExtHint === 'tiff') &&
    !(sourceExt === 'tiff' && targetExtHint === 'tif')

  const exportOptions = useMemo(
    () => buildEditorExportOptions(editSettings, targetFormat, quality, overwriteMode),
    [editSettings, targetFormat, quality, overwriteMode]
  )

  const outputPathArg = useMemo(() => {
    if (outputDestMode !== 'custom_dir' || !outputDir) return undefined
    return outputDir
  }, [outputDestMode, outputDir])

  const refreshPreview = useCallback(async () => {
    const api = window.electronAPI
    if (!filePath) return
    if (!api?.previewExport) {
      setPreviewUrl(null)
      message.warning('导出预览不可用，请完全退出后重新启动应用')
      return
    }
    const gen = ++previewGenRef.current
    setPreviewLoading(true)
    try {
      const result = await api.previewExport(filePath, exportOptions)
      if (previewGenRef.current !== gen) return
      setPreviewUrl(result.dataUrl)
      setPreviewSize(result.byteSize)
      setPreviewDims({ width: result.width, height: result.height })
    } catch (e: unknown) {
      if (previewGenRef.current !== gen) return
      setPreviewUrl(null)
      const detail = e instanceof Error ? e.message : String(e)
      message.error(`预览生成失败：${detail}`)
    } finally {
      if (previewGenRef.current === gen) setPreviewLoading(false)
    }
  }, [filePath, exportOptions, message])

  useEffect(() => {
    if (!open) return
    setTargetFormat(defaultTargetFormatFromPath(filePath))
    setQuality(85)
    setOverwriteMode('new_file')
    setOutputDestMode('source_dir')
    setOutputDir(null)
    setExportProgress(null)
    setPreviewUrl(null)
    setSiblingPaths([])
    setSiblingsLoading(true)
    void listSiblingImagesForExport(filePath)
      .then(setSiblingPaths)
      .finally(() => setSiblingsLoading(false))
  }, [open, filePath])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void refreshPreview()
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [open, refreshPreview])

  useEffect(() => {
    if (overwriteMode === 'overwrite' && outputDestMode === 'custom_dir') {
      setOutputDestMode('source_dir')
      setOutputDir(null)
    }
  }, [overwriteMode, outputDestMode])

  const handlePickOutputDir = async () => {
    const api = window.electronAPI
    if (!api?.openDirectory) {
      message.error('当前环境不支持选择文件夹')
      return
    }
    const dir = await api.openDirectory()
    if (dir) {
      setOutputDir(dir)
      setOutputDestMode('custom_dir')
    }
  }

  const validateBeforeExport = (): boolean => {
    if (outputDestMode === 'custom_dir' && !outputDir) {
      message.warning('请选择导出文件夹')
      return false
    }
    return true
  }

  const runExport = async (paths: string[], batch: boolean) => {
    const api = window.electronAPI
    if (!api?.convertFormat) {
      message.error('当前环境不支持导出')
      return
    }
    if (!validateBeforeExport()) return

    const showProgress = paths.length > 1
    setExporting(true)
    if (showProgress) {
      setExportProgress({ current: 0, total: paths.length, fileName: basenameFromPath(paths[0]) })
    } else {
      setExportProgress(null)
    }

    const allResults: BatchOperationResult[] = []

    try {
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i]
        const name = basenameFromPath(p)
        if (showProgress) {
          setExportProgress({ current: i, total: paths.length, fileName: name })
        }
        const results = await api.convertFormat([p], exportOptions, outputPathArg)
        allResults.push(...results)
        if (showProgress) {
          setExportProgress({ current: i + 1, total: paths.length, fileName: name })
        }
      }

      const failed = allResults.filter(r => !r.success)
      if (failed.length > 0) {
        message.error(
          batch || paths.length > 1
            ? `导出完成：${allResults.length - failed.length} 张成功，${failed.length} 张失败`
            : `导出失败：${failed[0]?.error || '未知错误'}`
        )
        if (failed.length === allResults.length) return
      }

      const firstOk = allResults.find(r => r.success)
      const savedPath = firstOk?.newPath || paths[0]
      if (batch || paths.length > 1) {
        const okCount = allResults.filter(r => r.success).length
        message.success(`已导出 ${okCount} 张图片`)
        logSignedInUserAction(
          'image_editor_batch_export',
          `同文件夹批量导出 ${okCount} 张${outputPathArg ? ` → ${outputPathArg}` : ''}`
        )
      } else {
        message.success(overwriteMode === 'overwrite' ? '已覆盖保存' : '已导出')
        logSignedInUserAction('image_format_convert_editor', '编辑器内导出', savedPath)
      }
      onSuccess({ filePath: savedPath, batch: batch || paths.length > 1 })
    } catch (e: unknown) {
      message.error(`导出出错：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExporting(false)
      setExportProgress(null)
    }
  }

  const handleExportCurrent = () => {
    void runExport([filePath], false)
  }

  const outputDestSummary = () => {
    if (overwriteMode === 'overwrite') return '覆盖原图所在目录'
    if (outputDestMode === 'custom_dir' && outputDir) {
      return truncatePathForDisplay(outputDir)
    }
    return truncatePathForDisplay(sourceDir)
  }

  const handleBatchExport = () => {
    if (siblingPaths.length === 0) {
      message.warning('当前文件夹无其它可处理图片')
      return
    }
    if (!validateBeforeExport()) return
    const count = siblingPaths.length
    modal.confirm({
      zIndex: EDITOR_EXPORT_MODAL_Z_INDEX + 10,
      title: '同文件夹批量导出',
      content: (
        <div>
          <p>
            将对当前文件夹内 <strong>{count}</strong> 张其它图片应用与当前相同的编辑与导出设置（不含本图）。
          </p>
          <p>
            导出位置：{outputDestSummary()}
          </p>
          <p style={{ marginBottom: 0 }}>
            输出方式：{overwriteMode === 'overwrite' ? '覆盖原图' : '另存为新文件'}
            {formatChangedOnOverwrite ? '；若格式变更将替换为同主名新扩展名文件' : ''}
          </p>
        </div>
      ),
      okText: '开始导出',
      cancelText: '取消',
      onOk: async () => {
        await runExport(siblingPaths, true)
      },
    })
  }

  const progressPercent =
    exportProgress && exportProgress.total > 0
      ? Math.round((exportProgress.current / exportProgress.total) * 100)
      : 0

  return (
    <ConfigProvider theme={{ token: { zIndexPopupBase: EDITOR_EXPORT_POPUP_Z_INDEX_BASE } }}>
      <Modal
        open={open}
        title="导出预览"
        onCancel={onClose}
        footer={null}
        width={600}
        destroyOnClose
        zIndex={EDITOR_EXPORT_MODAL_Z_INDEX}
        getContainer={() => document.body}
        rootClassName="editor-export-dialog-root"
        className="editor-export-dialog"
        maskClosable={!exporting}
        closable={!exporting}
      >
        <div className="editor-export-dialog__body">
          <div className="editor-export-dialog__preview-wrap">
            {previewLoading ? (
              <div className="editor-export-dialog__preview-loading">
                <Spin />
                <Text type="secondary">生成预览…</Text>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="导出预览"
                className="editor-export-dialog__preview-img"
              />
            ) : (
              <div className="editor-export-dialog__preview-loading">
                <Text type="secondary">暂无预览</Text>
              </div>
            )}
            {previewDims.width > 0 ? (
              <Text type="secondary" className="editor-export-dialog__preview-meta">
                {previewDims.width} × {previewDims.height} px
                {previewSize > 0 ? ` · 预览图约 ${formatByteSize(previewSize)}` : ''}
              </Text>
            ) : null}
            <Text type="secondary" className="editor-export-dialog__preview-hint">
              预览按长边 1280 px 降采样生成，实际导出体积随原图尺寸变化
            </Text>
          </div>

          {exportProgress && exportProgress.total > 1 ? (
            <div className="editor-export-dialog__progress">
              <Progress
                percent={progressPercent}
                status={exporting ? 'active' : 'success'}
                showInfo
              />
              <Text type="secondary" className="editor-export-dialog__progress-label">
                正在导出 {exportProgress.current}/{exportProgress.total}
                {exportProgress.fileName ? ` · ${exportProgress.fileName}` : ''}
              </Text>
            </div>
          ) : null}

          <div className="editor-export-dialog__controls">
            <div className="editor-export-dialog__format-quality-row">
              <div className="editor-export-dialog__field editor-export-dialog__field--inline">
                <Text className="editor-export-dialog__label">目标格式</Text>
                <Select
                  value={targetFormat}
                  onChange={setTargetFormat}
                  options={FORMAT_OPTIONS}
                  disabled={exporting}
                />
              </div>
              <div className="editor-export-dialog__field editor-export-dialog__field--inline">
                <div className="editor-export-dialog__label-row">
                  <Text className="editor-export-dialog__label">压缩质量</Text>
                  <InputNumber
                    min={1}
                    max={100}
                    size="small"
                    value={quality}
                    disabled={exporting}
                    onChange={v => v != null && setQuality(v)}
                    formatter={v => `${v}%`}
                    parser={v => Number.parseInt(String(v).replace('%', ''), 10) || 85}
                  />
                </div>
                <Slider
                  min={1}
                  max={100}
                  value={quality}
                  onChange={setQuality}
                  disabled={exporting}
                />
              </div>
            </div>

            <div className="editor-export-dialog__field">
              <Text className="editor-export-dialog__label">导出位置</Text>
              <Radio.Group
                value={outputDestMode}
                disabled={exporting || overwriteMode === 'overwrite'}
                onChange={e => {
                  const mode = e.target.value as OutputDestMode
                  setOutputDestMode(mode)
                  if (mode === 'source_dir') setOutputDir(null)
                }}
              >
                <Radio value="source_dir">与原图同目录</Radio>
                <Radio value="custom_dir">指定文件夹</Radio>
              </Radio.Group>
              {overwriteMode === 'overwrite' ? (
                <Text type="secondary" className="editor-export-dialog__hint">
                  覆盖原图时固定保存在原文件位置
                </Text>
              ) : null}
              {outputDestMode === 'custom_dir' ? (
                <div className="editor-export-dialog__folder-row">
                  <Text type="secondary" className="editor-export-dialog__folder-path" title={outputDir ?? undefined}>
                    {outputDir ? truncatePathForDisplay(outputDir, 56) : '未选择文件夹'}
                  </Text>
                  <Button
                    icon={<TbFolderOpen size={16} />}
                    onClick={() => void handlePickOutputDir()}
                    disabled={exporting}
                  >
                    选择文件夹
                  </Button>
                </div>
              ) : (
                <Text type="secondary" className="editor-export-dialog__hint" title={sourceDir}>
                  {truncatePathForDisplay(sourceDir, 56)}
                </Text>
              )}
            </div>

            <div className="editor-export-dialog__field">
              <Text className="editor-export-dialog__label">输出方式</Text>
              <Radio.Group
                value={overwriteMode}
                disabled={exporting}
                onChange={e => setOverwriteMode(e.target.value as EditorExportOverwriteMode)}
              >
                <Radio value="new_file">另存为新文件</Radio>
                <Radio value="overwrite">覆盖原图</Radio>
              </Radio.Group>
              {formatChangedOnOverwrite ? (
                <Text type="warning" className="editor-export-dialog__warn">
                  覆盖模式下更改格式将删除原文件并写入 .{targetExtHint}
                </Text>
              ) : null}
            </div>
          </div>
        </div>

        <div className="editor-export-dialog__footer">
          <Space wrap>
            <Button type="primary" loading={exporting} onClick={handleExportCurrent}>
              导出当前
            </Button>
            <Button
              loading={exporting}
              disabled={siblingsLoading || siblingPaths.length === 0}
              onClick={handleBatchExport}
            >
              同文件夹批量导出
              {siblingPaths.length > 0 ? ` (${siblingPaths.length})` : ''}
            </Button>
            <Button disabled={exporting} onClick={onClose}>
              取消
            </Button>
          </Space>
          {siblingPaths.length === 0 && !siblingsLoading ? (
            <Text type="secondary" className="editor-export-dialog__batch-hint">
              当前文件夹无其它可处理图片
            </Text>
          ) : null}
        </div>
      </Modal>
    </ConfigProvider>
  )
}

export default EditorExportDialog
