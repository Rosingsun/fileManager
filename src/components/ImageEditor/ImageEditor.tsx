import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button, Space, message } from 'antd'
import ImageEditorShell from './ImageEditorShell'
import EditorPreviewCanvas, { type PreviewViewMode } from './EditorPreviewCanvas'
import EditorSidebar from './EditorSidebar'
import EditorExportDialog from './EditorExportDialog'
import { useImageEditor } from './useImageEditor'
import {
  hasAnyEdit,
  countActiveEdits,
  imageLoader,
  needsSharpPreview,
  settingsForComparePreview,
  settingsForSharpPreview,
  rgbToWhiteBalance,
} from '../../utils'
import type { ImageEditSettings } from '../../types'

interface ImageEditorProps {
  visible: boolean
  filePath: string
  onClose: () => void
  onSaved?: (result: { success: boolean; filePath: string }) => void
}

const PREVIEW_DEBOUNCE_MS = 260
/**
 * 画布显示所需的长边像素。原图（尤其 24MP）整块转 base64 经 IPC 传输会占用大量内存与主线程时间，
 * 编辑器只需要「够屏幕清晰」的尺寸，导出仍走原文件，不受影响。
 */
const EDITOR_IMAGE_MAX_EDGE = 2560

const ImageEditor: React.FC<ImageEditorProps> = ({ visible, filePath, onClose, onSaved }) => {
  const { settings, setSettings, updateSettings, resetSettings } = useImageEditor()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  /** 始终为未编辑的原始 base64，供「对比原图」使用 */
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [loadingImage, setLoadingImage] = useState(false)
  const [showCropOverlay, setShowCropOverlay] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [sharpPreviewUrl, setSharpPreviewUrl] = useState<string | null>(null)
  /** 对比视图全画幅 Sharp 预览（不含裁切），仅进入对比模式时生成 */
  const [sharpCompareUrl, setSharpCompareUrl] = useState<string | null>(null)
  const [sharpPreviewLoading, setSharpPreviewLoading] = useState(false)
  const [autoEnhanceLoading, setAutoEnhanceLoading] = useState(false)
  const [pickWhiteBalanceMode, setPickWhiteBalanceMode] = useState(false)
  const [viewMode, setViewMode] = useState<PreviewViewMode>('single')
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewGenRef = useRef(0)

  const fileName = filePath ? filePath.split(/[/\\]/).pop() ?? filePath : ''

  const previewSrc = useMemo(
    () => sharpPreviewUrl ?? imageUrl ?? originalImageUrl ?? null,
    [sharpPreviewUrl, imageUrl, originalImageUrl]
  )

  /** 直方图等下游只需感知参数变化，不要把数 MB 的 base64 拼进摘要 */
  const settingsDigest = useMemo(() => JSON.stringify(settings), [settings])

  const loadImage = useCallback(async () => {
    if (!filePath) return
    setLoadingImage(true)
    try {
      if (window.electronAPI?.getImageBase64) {
        const base64 = await window.electronAPI.getImageBase64(filePath, EDITOR_IMAGE_MAX_EDGE)
        if (base64 && base64.startsWith('data:image')) {
          setImageUrl(base64)
          setOriginalImageUrl(base64)
        } else {
          setImageUrl(null)
          setOriginalImageUrl(null)
          message.error('无法加载图片')
        }
      } else {
        const fileUrl = `file://${filePath}`
        setImageUrl(fileUrl)
        setOriginalImageUrl(fileUrl)
      }
      if (window.electronAPI?.getImageDimensions) {
        const dim = await window.electronAPI.getImageDimensions(filePath)
        if (dim) setImageSize({ width: dim.width, height: dim.height })
      }
    } catch (error) {
      console.error('加载图片失败:', error)
      setImageUrl(null)
    } finally {
      setLoadingImage(false)
    }
  }, [filePath])

  useEffect(() => {
    if (visible && filePath) {
      void loadImage()
    } else {
      setImageUrl(null)
      setOriginalImageUrl(null)
      setSharpPreviewUrl(null)
    }
  }, [visible, filePath, loadImage])

  const handleSettingsChange = useCallback(
    (updates: Partial<ImageEditSettings>) => {
      updateSettings(updates)
    },
    [updateSettings]
  )

  useEffect(() => {
    if (!visible) {
      resetSettings()
      setImageUrl(null)
      setOriginalImageUrl(null)
      setSharpPreviewUrl(null)
      setSharpCompareUrl(null)
      setShowCropOverlay(false)
      setViewMode('single')
      setPickWhiteBalanceMode(false)
    }
  }, [visible, resetSettings])

  /** 交给主进程的预览参数：剥离 CSS 可即时还原项与几何项；裁切模式下先不裁，保证遮罩坐标可用 */
  const sharpPreviewPayload = useMemo(() => {
    const base = showCropOverlay ? settingsForComparePreview(settings) : settings
    return settingsForSharpPreview(base)
  }, [settings, showCropOverlay])

  /** 只有「剔除基础项后仍有高级效果」才需要主进程渲染，纯裁切时直接用原图 + 遮罩 */
  const needSharpPreview = useMemo(
    () => needsSharpPreview(settings) && hasAnyEdit(sharpPreviewPayload),
    [settings, sharpPreviewPayload]
  )

  useEffect(() => {
    if (!visible || !filePath || !imageUrl) return

    if (!needSharpPreview) {
      setSharpPreviewUrl(null)
      setSharpCompareUrl(null)
      setSharpPreviewLoading(false)
      return
    }

    const api = window.electronAPI
    if (!api?.previewEdits) return

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    setSharpPreviewLoading(true)
    const gen = ++previewGenRef.current
    const needComparePreview = viewMode === 'wipe' && !!settings.crop

    previewTimerRef.current = setTimeout(() => {
      const mainPreview = api.previewEdits(filePath, sharpPreviewPayload)
      const comparePreview = needComparePreview
        ? api.previewEdits(filePath, settingsForSharpPreview(settingsForComparePreview(settings)))
        : Promise.resolve(null as string | null)

      void Promise.all([mainPreview, comparePreview])
        .then(([url, compareUrl]) => {
          if (previewGenRef.current !== gen) return
          setSharpPreviewUrl(url)
          setSharpCompareUrl(compareUrl ?? null)
          setSharpPreviewLoading(false)
        })
        .catch(() => {
          if (previewGenRef.current !== gen) return
          setSharpPreviewLoading(false)
        })
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [visible, filePath, imageUrl, settings, sharpPreviewPayload, needSharpPreview, viewMode])

  const handleApplyPreset = useCallback(
    (presetSettings: ImageEditSettings) => {
      setSettings(presetSettings)
    },
    [setSettings]
  )

  const handleReset = () => {
    resetSettings()
    setSharpPreviewUrl(null)
    setSharpCompareUrl(null)
  }

  const handlePickWhiteBalance = useCallback(
    (rgb: { r: number; g: number; b: number }) => {
      const wb = rgbToWhiteBalance(rgb.r, rgb.g, rgb.b)
      updateSettings(wb)
      setPickWhiteBalanceMode(false)
      message.success('已根据采样点设置色温与色调')
    },
    [updateSettings]
  )

  const handleAutoEnhance = async () => {
    const api = window.electronAPI
    if (!api?.analyzeForEdit || !filePath) {
      message.warning('当前环境不支持一键增强')
      return
    }
    setAutoEnhanceLoading(true)
    try {
      const suggested = await api.analyzeForEdit(filePath)
      setSettings({ ...settings, ...suggested })
      message.success('已应用增强建议，可继续微调')
    } catch (e: unknown) {
      message.error(`分析失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setAutoEnhanceLoading(false)
    }
  }

  const handleSave = () => {
    if (!filePath) {
      message.error('文件路径不可用，无法导出')
      return
    }
    setExportDialogOpen(true)
  }

  const handleExportSuccess = (result: { filePath: string }) => {
    setExportDialogOpen(false)
    imageLoader.clearCache(result.filePath)
    if (filePath !== result.filePath) imageLoader.clearCache(filePath)
    onSaved?.({ success: true, filePath: result.filePath })
    onClose()
  }

  const handleToggleCropMode = useCallback((show: boolean) => {
    setShowCropOverlay(show)
    if (show) setPickWhiteBalanceMode(false)
  }, [])

  const sizeMeta =
    imageSize.width > 0 ? `${imageSize.width} × ${imageSize.height}` : undefined

  return (
    <>
      <ImageEditorShell
        open={visible}
        title={fileName || '图片编辑'}
        meta={sizeMeta}
        onClose={onClose}
        toolbarExtra={
          <Space>
            <Button onClick={handleReset} disabled={exportDialogOpen || !hasAnyEdit(settings)}>
              重置
            </Button>
            <Button onClick={onClose} disabled={exportDialogOpen}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              disabled={exportDialogOpen || loadingImage || !imageUrl}
            >
              导出
            </Button>
          </Space>
        }
      >
        <div className="image-editor-layout">
          <EditorPreviewCanvas
            imageUrl={imageUrl}
            originalUrl={originalImageUrl}
            sharpPreviewUrl={sharpPreviewUrl}
            sharpCompareUrl={sharpCompareUrl}
            sharpPreviewLoading={sharpPreviewLoading}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            imageWidth={imageSize.width}
            imageHeight={imageSize.height}
            showCropOverlay={showCropOverlay}
            loading={loadingImage}
            editCount={countActiveEdits(settings)}
            pickWhiteBalanceMode={pickWhiteBalanceMode}
            onPickWhiteBalance={handlePickWhiteBalance}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          <EditorSidebar
            settings={settings}
            onChange={handleSettingsChange}
            onApplyPreset={handleApplyPreset}
            previewSrc={previewSrc}
            settingsDigest={settingsDigest}
            showCropMode={showCropOverlay}
            onToggleCropMode={handleToggleCropMode}
            imageWidth={imageSize.width}
            imageHeight={imageSize.height}
            onAutoEnhance={handleAutoEnhance}
            autoEnhanceLoading={autoEnhanceLoading}
            filePath={filePath}
            onPickWhiteBalance={() => setPickWhiteBalanceMode(m => !m)}
            pickWhiteBalanceActive={pickWhiteBalanceMode}
          />
        </div>
      </ImageEditorShell>

      <EditorExportDialog
        open={exportDialogOpen}
        filePath={filePath}
        editSettings={settings}
        onClose={() => setExportDialogOpen(false)}
        onSuccess={handleExportSuccess}
      />
    </>
  )
}

export default ImageEditor
