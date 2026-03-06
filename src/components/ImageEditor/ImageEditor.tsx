import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Modal, Button, Space, Spin, message } from 'antd'
import EditorControls from './EditorControls'
import PresetsPanel from './PresetsPanel'
import FormatCompressDialog from './FormatCompressDialog'
import CropOverlay from './CropOverlay'
import { useImageEditor } from './useImageEditor'
import { getFilterCss } from '../../utils/imageEditorUtils'
import type { ImageEditSettings } from '../../types'

const getTransform = (settings: ImageEditSettings): string => {
  const transforms: string[] = []
  if (settings.rotation) {
    transforms.push(`rotate(${settings.rotation}deg)`)
  }
  if (settings.flipHorizontal) {
    transforms.push('scaleX(-1)')
  }
  if (settings.flipVertical) {
    transforms.push('scaleY(-1)')
  }
  return transforms.length > 0 ? transforms.join(' ') : 'none'
}

interface ImageEditorProps {
  visible: boolean
  filePath: string
  onClose: () => void
  onSaved?: (result: { success: boolean; filePath: string }) => void
}

const ImageEditor: React.FC<ImageEditorProps> = ({ visible, filePath, onClose, onSaved }) => {
  const { settings, setSettings, updateSetting, resetSettings } = useImageEditor()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loadingImage, setLoadingImage] = useState(false)
  const [openFormatDialog, setOpenFormatDialog] = useState(false)
  const [showCropOverlay, setShowCropOverlay] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const imgRef = useRef<HTMLImageElement>(null)

  const loadImage = useCallback(async () => {
    if (!filePath) return
    setLoadingImage(true)
    try {
      if (window.electronAPI?.getImageBase64) {
        const base64 = await window.electronAPI.getImageBase64(filePath)
        if (base64 && base64.startsWith('data:image')) {
          setImageUrl(base64)
        } else {
          setImageUrl(null)
          message.error('无法加载图片')
        }
      } else {
        setImageUrl(`file://${filePath}`)
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
      loadImage()
    } else {
      setImageUrl(null)
    }
  }, [visible, filePath, loadImage])

  const handleSettingsChange = useCallback((updates: Partial<ImageEditSettings>) => {
    Object.entries(updates).forEach(([key, value]) => {
      updateSetting(key as any, value)
    })
  }, [updateSetting])

  useEffect(() => {
    if (!visible) {
      resetSettings()
      setImageUrl(null)
    }
  }, [visible, resetSettings])

  const handleApplyPreset = (presetSettings: ImageEditSettings) => {
    setSettings(presetSettings)
  }

  const handleReset = () => {
    resetSettings()
  }

  const handleSave = async () => {
    try {
      const api = window.electronAPI
      if (!api) {
        throw new Error('electronAPI not available')
      }
      const res = await api.applyEdits(filePath, settings)
      if (res[0]?.success) {
        onSaved && onSaved({ success: true, filePath })
      } else {
        onSaved && onSaved({ success: false, filePath })
      }
    } catch (e) {
      console.error(e)
      onSaved && onSaved({ success: false, filePath })
    }
    onClose()
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="图片编辑"
      width={900}
      footer={
        <Space>
          <Button onClick={() => setOpenFormatDialog(true)}>格式/压缩</Button>
          <Button onClick={handleReset}>重置</Button>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>保存</Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ 
          flex: 1, 
          textAlign: 'center',
          background: 'rgba(248, 248, 248, 0.5)',
          borderRadius: 8,
          padding: 16,
          minHeight: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          {loadingImage ? (
            <Spin size="large" tip="加载图片中..." />
          ) : imageUrl ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                ref={imgRef}
                src={imageUrl}
                alt="preview"
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement
                  setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
                }}
                style={{
                  maxWidth: '100%',
                  maxHeight: '500px',
                  filter: getFilterCss(settings),
                  transform: getTransform(settings),
                  borderRadius: 4,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  display: showCropOverlay ? 'none' : 'block'
                }}
              />
              {showCropOverlay && imageSize.width > 0 && (
                <div style={{ position: 'relative', width: 'fit-content', margin: '0 auto' }}>
                  <img
                    src={imageUrl}
                    alt="preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '500px',
                      filter: getFilterCss(settings),
                      transform: getTransform(settings),
                      borderRadius: 4
                    }}
                  />
                  <CropOverlay
                    settings={settings}
                    onChange={handleSettingsChange}
                    imageWidth={imageSize.width}
                    imageHeight={imageSize.height}
                  />
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#999' }}>无法加载图片</div>
          )}
        </div>
        <div style={{ 
          width: 320, 
          background: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(20px)',
          borderRadius: 8,
          border: '1px solid rgba(0, 0, 0, 0.1)'
        }}>
          <PresetsPanel onApply={handleApplyPreset} currentSettings={settings} />
          <EditorControls 
            settings={settings} 
            onChange={handleSettingsChange}
            showCropMode={showCropOverlay}
            onToggleCropMode={setShowCropOverlay}
            imageWidth={imageSize.width}
            imageHeight={imageSize.height}
          />
        </div>
      </div>
      <FormatCompressDialog
        visible={openFormatDialog}
        files={[filePath]}
        onClose={() => setOpenFormatDialog(false)}
        onConvert={opts => {
          const api = window.electronAPI
          if (api) {
            api.convertFormat(filePath, opts).then(() => setOpenFormatDialog(false))
          }
        }}
        onCompress={opts => {
          const api = window.electronAPI
          if (api) {
            api.compressImage(filePath, opts).then(() => setOpenFormatDialog(false))
          }
        }}
      />
    </Modal>
  )
}

export default ImageEditor
