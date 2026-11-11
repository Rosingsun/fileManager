import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Button, Space, message, Segmented, Spin, Progress } from 'antd'
import EditorAdjustPanel from './EditorAdjustPanel'
import EditorColorPanel from './EditorColorPanel'
import EditorEffectsPanel from './EditorEffectsPanel'
import EditorGeometryPanel from './EditorGeometryPanel'
import PresetsPanel from './PresetsPanel'
import { useImageEditor } from './useImageEditor'
import { imageLoader, isPreviewableImage, logSignedInUserAction } from '../../utils'
import type { ImageEditSettings } from '../../types'

interface BatchEditModalProps {
  visible: boolean
  filePaths: string[]
  onClose: () => void
  /** 批量处理完成后回调，便于列表刷新 */
  onApplied?: (count: number) => void
}

type BatchPanelKey = 'presets' | 'adjust' | 'color' | 'effects' | 'geometry'

const PREVIEW_DEBOUNCE_MS = 300

function isImagePath(path: string): boolean {
  const m = path.match(/\.([a-zA-Z0-9]+)$/)
  return m ? isPreviewableImage(m[1]) : false
}

const BatchEditModal: React.FC<BatchEditModalProps> = ({ visible, filePaths, onClose, onApplied }) => {
  const { settings, setSettings, updateSettings } = useImageEditor()
  const [panel, setPanel] = useState<BatchPanelKey>('presets')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const previewGenRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** 只处理可预览图片，避免把视频/文档混进 Sharp 管线后集体失败 */
  const imagePaths = useMemo(() => filePaths.filter(isImagePath), [filePaths])
  const firstPath = imagePaths[0] ?? ''
  const settingsDigest = useMemo(() => JSON.stringify(settings), [settings])

  const handleSettingsChange = useCallback(
    (updates: Partial<ImageEditSettings>) => updateSettings(updates),
    [updateSettings]
  )

  const handleApplyPreset = useCallback(
    (presetSettings: ImageEditSettings) => setSettings(presetSettings),
    [setSettings]
  )

  useEffect(() => {
    if (!visible) return
    setPanel('presets')
    setProgress(null)
  }, [visible])

  useEffect(() => {
    if (!visible || !firstPath) {
      setPreviewUrl(null)
      return
    }
    const api = window.electronAPI
    if (!api?.previewEdits) return

    if (timerRef.current) clearTimeout(timerRef.current)
    const gen = ++previewGenRef.current
    setPreviewLoading(true)
    timerRef.current = setTimeout(() => {
      void api
        .previewEdits(firstPath, settings)
        .then(url => {
          if (previewGenRef.current !== gen) return
          setPreviewUrl(url)
          setPreviewLoading(false)
        })
        .catch(() => {
          if (previewGenRef.current !== gen) return
          setPreviewLoading(false)
        })
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible, firstPath, settings])

  const handleBatchApply = async () => {
    if (imagePaths.length === 0) {
      message.warning('选中的文件中没有可编辑的图片')
      return
    }
    const api = window.electronAPI
    if (!api?.applyEdits) {
      message.error('当前环境不支持批量编辑')
      return
    }

    setApplying(true)
    setProgress({ done: 0, total: imagePaths.length })
    const failed: { filePath: string; error?: string }[] = []
    let okCount = 0

    try {
      for (let i = 0; i < imagePaths.length; i++) {
        const p = imagePaths[i]
        try {
          const res = await api.applyEdits([p], settings)
          const r = res[0]
          if (r?.success) {
            okCount += 1
            imageLoader.clearCache(p)
            if (r.newPath) imageLoader.clearCache(r.newPath)
          } else {
            failed.push({ filePath: p, error: r?.error })
          }
        } catch (e) {
          failed.push({ filePath: p, error: e instanceof Error ? e.message : String(e) })
        }
        setProgress({ done: i + 1, total: imagePaths.length })
      }

      if (failed.length > 0) {
        message.error(`完成 ${okCount} 张，失败 ${failed.length} 张：${failed[0]?.filePath ?? ''}`)
      } else {
        message.success(`已生成 ${okCount} 张新图片，原文件均未修改`)
      }
      if (okCount > 0) {
        logSignedInUserAction('image_editor_batch_apply', `批量编辑应用（${okCount} 张）`)
        onApplied?.(okCount)
      }
    } catch (e: unknown) {
      message.error(`批量处理出错：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setApplying(false)
      setProgress(null)
      onClose()
    }
  }

  const renderPanel = () => {
    switch (panel) {
      case 'presets':
        return (
          <PresetsPanel
            layout="modal"
            onApply={handleApplyPreset}
            currentSettings={settings}
            previewSrc={previewUrl}
          />
        )
      case 'color':
        return <EditorColorPanel settings={settings} onChange={handleSettingsChange} />
      case 'effects':
        return <EditorEffectsPanel settings={settings} onChange={handleSettingsChange} />
      case 'geometry':
        return <EditorGeometryPanel settings={settings} onChange={handleSettingsChange} />
      case 'adjust':
      default:
        return (
          <EditorAdjustPanel
            settings={settings}
            onChange={handleSettingsChange}
            previewSrc={previewUrl}
            settingsDigest={settingsDigest}
            filePath={firstPath || undefined}
          />
        )
    }
  }

  const skipped = filePaths.length - imagePaths.length

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="批量编辑图片"
      width={960}
      maskClosable={!applying}
      closable={!applying}
      footer={
        <Space>
          <Button onClick={onClose} disabled={applying}>
            取消
          </Button>
          <Button type="primary" loading={applying} onClick={() => void handleBatchApply()}>
            应用到 {imagePaths.length} 张图片
          </Button>
        </Space>
      }
    >
      <div className="batch-edit-layout">
        <div className="batch-edit-preview">
          <div className="batch-edit-preview__stage">
            {previewLoading && !previewUrl ? (
              <Spin tip="渲染预览…">
                <div style={{ width: 120, height: 90 }} />
              </Spin>
            ) : previewUrl ? (
              <img className="batch-edit-preview__img" src={previewUrl} alt="批量编辑预览" />
            ) : (
              <span style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>
                {imagePaths.length > 0 ? '暂无预览' : '没有可编辑的图片'}
              </span>
            )}
            {previewLoading && previewUrl ? (
              <div className="image-editor-preview-loading">
                <Spin size="small" /> 渲染预览…
              </div>
            ) : null}
          </div>
          <div className="batch-edit-preview__meta">
            <span>
              预览：{firstPath.split(/[/\\]/).pop() || '—'}
              {imagePaths.length > 1 ? `（共 ${imagePaths.length} 张，预览首张）` : ''}
            </span>
            {skipped > 0 ? <span>已忽略 {skipped} 个非图片文件</span> : null}
          </div>
          {progress ? (
            <div style={{ padding: '0 12px 12px' }}>
              <Progress
                percent={Math.round((progress.done / Math.max(1, progress.total)) * 100)}
                size="small"
                status={applying ? 'active' : 'success'}
              />
              <span style={{ fontSize: 11, color: 'var(--app-text-secondary)' }}>
                正在处理 {progress.done}/{progress.total}
              </span>
            </div>
          ) : null}
        </div>

        <div className="batch-edit-panel">
          <div className="batch-edit-panel__nav">
            <Segmented
              size="small"
              block
              value={panel}
              onChange={v => setPanel(v as BatchPanelKey)}
              options={[
                { label: '预设', value: 'presets' },
                { label: '调整', value: 'adjust' },
                { label: '色彩', value: 'color' },
                { label: '效果', value: 'effects' },
                { label: '几何', value: 'geometry' },
              ]}
            />
          </div>
          <div className="batch-edit-panel__scroll">{renderPanel()}</div>
        </div>
      </div>
    </Modal>
  )
}

export default BatchEditModal
