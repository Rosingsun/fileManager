import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button, Space, message } from 'antd'
import ImageEditorShell from './ImageEditorShell'
import EditorPreviewCanvas from './EditorPreviewCanvas'
import EditorSidebar from './EditorSidebar'
import FormatCompressDialog from './FormatCompressDialog'
import { useImageEditor } from './useImageEditor'
import {
  hasAnyEdit,
  countActiveEdits,
  imageLoader,
  logSignedInUserAction,
  settingsForComparePreview,
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
  const [openFormatDialog, setOpenFormatDialog] = useState(false)
  const [showCropOverlay, setShowCropOverlay] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [saving, setSaving] = useState(false)
  const [sharpPreviewUrl, setSharpPreviewUrl] = useState<string | null>(null)
  /** 对比视图全画幅 Sharp 预览（不含裁切） */
  const [sharpCompareUrl, setSharpCompareUrl] = useState<string | null>(null)
  const [sharpPreviewLoading, setSharpPreviewLoading] = useState(false)
  const [autoEnhanceLoading, setAutoEnhanceLoading] = useState(false)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewGenRef = useRef(0)

  const fileName = filePath ? filePath.split(/[/\\]/).pop() ?? filePath : ''

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

  const handleSave = async () => {
    if (!filePath) {
      message.error('文件路径不可用，无法保存')
      return
    }

    setSaving(true)
    try {
      const api = window.electronAPI
      if (!api) throw new Error('electronAPI not available')
      const res = await api.applyEdits(filePath, settings)
      const first = res?.[0]
      if (first?.success) {
        const savedPath = first.newPath || filePath
        message.success(first.newPath ? `已另存为新文件（原图未修改）` : '已保存')
        logSignedInUserAction('image_editor_apply', '图片编辑器应用调整', savedPath)
        imageLoader.clearCache(savedPath)
        if (filePath !== savedPath) imageLoader.clearCache(filePath)
        onSaved?.({ success: true, filePath: savedPath })
      } else {
        message.error(`保存失败：${first?.error || '返回结果为空'}`)
        onSaved?.({ success: false, filePath })
      }
    } catch (e: unknown) {
      message.error(`保存出错：${e instanceof Error ? e.message : String(e)}`)
      onSaved?.({ success: false, filePath })
    } finally {
      setSaving(false)
      onClose()
    }
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
            <Button onClick={() => setOpenFormatDialog(true)} disabled={saving}>
              格式/压缩
            </Button>
            <Button onClick={handleReset} disabled={saving}>
              重置
            </Button>
            <Button onClick={onClose} disabled={saving}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              disabled={saving || loadingImage || !imageUrl}
              loading={saving}
            >
              保存
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
          />
          <EditorSidebar
            settings={settings}
            onChange={handleSettingsChange}
            onApplyPreset={handleApplyPreset}
            showCropMode={showCropOverlay}
            onToggleCropMode={setShowCropOverlay}
            imageWidth={imageSize.width}
            imageHeight={imageSize.height}
            onAutoEnhance={handleAutoEnhance}
            autoEnhanceLoading={autoEnhanceLoading}
          />
        </div>
      </ImageEditorShell>

      <FormatCompressDialog
        visible={openFormatDialog}
        files={[filePath]}
        onClose={() => setOpenFormatDialog(false)}
        onConvert={opts => {
          const api = window.electronAPI
          if (api) {
            void api.convertFormat(filePath, opts).then(results => {
              if (results?.every(r => r.success)) {
                logSignedInUserAction('image_format_convert_editor', '编辑器内格式转换', filePath)
              }
              setOpenFormatDialog(false)
            })
          }
        }}
        onCompress={opts => {
          const api = window.electronAPI
          if (api) {
            void api.compressImage(filePath, opts).then(results => {
              if (results?.every(r => r.success)) {
                logSignedInUserAction('image_compress', '编辑器内图片压缩', filePath)
              }
              setOpenFormatDialog(false)
            })
          }
        }}
      />
    </>
  )
}

export default ImageEditor
