import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button, Space, message } from 'antd'
import ImageEditorShell from './ImageEditorShell'
import EditorPreviewCanvas from './EditorPreviewCanvas'
import EditorSidebar from './EditorSidebar'
import EditorExportDialog from './EditorExportDialog'
import { useImageEditor } from './useImageEditor'
import {
  hasAnyEdit,
  countActiveEdits,
  imageLoader,
  settingsForComparePreview,
  rgbToWhiteBalance,
} from '../../utils'
import type { ImageEditSettings } from '../../types'

interface ImageEditorProps {
  visible: boolean
  filePath: string
  onClose: () => void
  onSaved?: (result: { success: boolean; filePath: string }) => void
}

const PREVIEW_DEBOUNCE_MS = 300

const ImageEditor: React.FC<ImageEditorProps> = ({ visible, filePath, onClose, onSaved }) => {
  const { settings, setSettings, updateSetting, resetSettings } = useImageEditor()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  /** 始终为未编辑的原始 base64，供「对比原图」使用 */
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [loadingImage, setLoadingImage] = useState(false)
  const [showCropOverlay, setShowCropOverlay] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [sharpPreviewUrl, setSharpPreviewUrl] = useState<string | null>(null)
  /** 对比视图全画幅 Sharp 预览（不含裁切） */
  const [sharpCompareUrl, setSharpCompareUrl] = useState<string | null>(null)
  const [sharpPreviewLoading, setSharpPreviewLoading] = useState(false)
  const [autoEnhanceLoading, setAutoEnhanceLoading] = useState(false)
  const [pickWhiteBalanceMode, setPickWhiteBalanceMode] = useState(false)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewGenRef = useRef(0)

  const fileName = filePath ? filePath.split(/[/\\]/).pop() ?? filePath : ''

  const previewSrc = useMemo(
    () => sharpPreviewUrl ?? imageUrl ?? originalImageUrl ?? null,
    [sharpPreviewUrl, imageUrl, originalImageUrl]
  )

  const settingsDigest = useMemo(
    () => `${sharpPreviewUrl ?? ''}|${JSON.stringify(settings)}`,
    [sharpPreviewUrl, settings]
  )

  const loadImage = useCallback(async () => {
    if (!filePath) return
    setLoadingImage(true)
    try {
      if (window.electronAPI?.getImageBase64) {
        const base64 = await window.electronAPI.getImageBase64(filePath)
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
      Object.entries(updates).forEach(([key, value]) => {
        updateSetting(key as keyof ImageEditSettings, value)
      })
    },
    [updateSetting]
  )

  useEffect(() => {
    if (!visible) {
      resetSettings()
      setImageUrl(null)
      setOriginalImageUrl(null)
      setSharpPreviewUrl(null)
      setSharpCompareUrl(null)
      setShowCropOverlay(false)
    }
  }, [visible, resetSettings])

  const comparePreviewSettings = useMemo(
    () => settingsForComparePreview(settings),
    [settings]
  )

  useEffect(() => {
    if (!visible || !filePath || !imageUrl) return

    if (!hasAnyEdit(settings)) {
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
    const needComparePreview =
      !!settings.crop && hasAnyEdit(comparePreviewSettings)

    previewTimerRef.current = setTimeout(() => {
      const mainPreview = api.previewEdits(filePath, settings)
      const comparePreview = needComparePreview
        ? api.previewEdits(filePath, comparePreviewSettings)
        : Promise.resolve(null as string | null)

      void Promise.all([mainPreview, comparePreview])
        .then(([url, compareUrl]) => {
          if (previewGenRef.current !== gen) return
          setSharpPreviewUrl(url)
          setSharpCompareUrl(compareUrl)
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
  }, [visible, filePath, imageUrl, settings, comparePreviewSettings])

  const handleApplyPreset = (presetSettings: ImageEditSettings) => {
    setSettings(presetSettings)
  }

  const handleReset = () => {
    resetSettings()
    setSharpPreviewUrl(null)
    setSharpCompareUrl(null)
  }

  const handlePickWhiteBalance = useCallback(
    (rgb: { r: number; g: number; b: number }) => {
      const wb = rgbToWhiteBalance(rgb.r, rgb.g, rgb.b)
      handleSettingsChange(wb)
      setPickWhiteBalanceMode(false)
      message.success('已根据采样点设置色温与色调')
    },
    [handleSettingsChange]
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
            <Button onClick={handleReset} disabled={exportDialogOpen}>
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
          />
          <EditorSidebar
            settings={settings}
            onChange={handleSettingsChange}
            onApplyPreset={handleApplyPreset}
            previewSrc={previewSrc}
            settingsDigest={settingsDigest}
            showCropMode={showCropOverlay}
            onToggleCropMode={setShowCropOverlay}
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
