import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Modal, Button, Space, Spin, message } from 'antd'
import EditorControls from './EditorControls'
import PresetsPanel from './PresetsPanel'
import FormatCompressDialog from './FormatCompressDialog'
import CropOverlay from './CropOverlay'
import { useImageEditor } from './useImageEditor'
import { getFilterCss } from '../../utils/imageEditorUtils'
import { imageLoader } from '../../utils'
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
  const [saving, setSaving] = useState(false)
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
    if (!filePath) {
      message.error('文件路径不可用，无法保存')
      return
    }

    setSaving(true)
    try {
      const api = window.electronAPI
      if (!api) {
        throw new Error('electronAPI not available')
      }
      const res = await api.applyEdits(filePath, settings)
      console.log('[ImageEditor] applyEdits result:', res)
      const first = res && res[0]
      if (first && first.success) {
        if (first.newPath) {
          message.success(`已保存为：${first.newPath}`)
          imageLoader.clearCache(first.newPath)
          onSaved && onSaved({ success: true, filePath: first.newPath })
        } else {
          message.success('已保存')
          imageLoader.clearCache(filePath)
          onSaved && onSaved({ success: true, filePath })
        }
      } else {
        const errMsg = first?.error || '返回结果为空'
        message.error(`保存失败：${errMsg}`)
        onSaved && onSaved({ success: false, filePath })
      }
    } catch (e: any) {
      console.error('[ImageEditor] 保存出错', e)
      message.error(`保存出错：${e?.message || e}`)
      onSaved && onSaved({ success: false, filePath })
    } finally {
      setSaving(false)
      onClose()
    }
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="图片编辑"
      width={900}
      height={700}
      centered
      footer={
        <Space>
          <Button onClick={() => setOpenFormatDialog(true)} disabled={saving}>格式/压缩</Button>
          <Button onClick={handleReset} disabled={saving}>重置</Button>
          <Button onClick={onClose} disabled={saving}>取消</Button>
          <Button type="primary" onClick={handleSave} disabled={saving || loadingImage || !imageUrl} loading={saving}>保存</Button>
        </Space>
      }
      style={{
        borderRadius: 12,
        overflow: 'hidden'
      }}
    >
      <div style={{
        display: 'flex',
        gap: 16,
        height: 520,
        overflow: 'hidden'
      }}>
        {/* 左侧图片预览区 */}
        <div style={{
          flex: 1,
          textAlign: 'center',
          background: 'linear-gradient(135deg, #f5f5f7 0%, #ffffff 100%)',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          {loadingImage ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16
            }}>
              <Spin size="large" style={{ color: '#007AFF' }} />
              <div style={{
                fontSize: 14,
                color: '#6e6e73',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
              }}>
                加载图片中...
              </div>
            </div>
          ) : imageUrl ? (
            <div style={{
              position: 'relative',
              display: 'inline-block',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              backgroundColor: '#ffffff'
            }}>
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
                  maxHeight: '450px',
                  filter: getFilterCss(settings),
                  transform: getTransform(settings),
                  display: showCropOverlay ? 'none' : 'block',
                  transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
                }}
              />
              {showCropOverlay && imageSize.width > 0 && (
                <div style={{ position: 'relative', width: 'fit-content', margin: '0 auto' }}>
                  <img
                    src={imageUrl}
                    alt="preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '450px',
                      filter: getFilterCss(settings),
                      transform: getTransform(settings)
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
            <div style={{
              color: '#86868b',
              fontSize: 14,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
            }}>
              无法加载图片
            </div>
          )}
        </div>

        {/* 右侧控制面板 - 可滚动 */}
        <div style={{
          width: 340,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: 12,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* 预设面板 */}
          <div style={{
            padding: 16,
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
          }}>
            <PresetsPanel onApply={handleApplyPreset} currentSettings={settings} />
          </div>
          
          {/* 编辑控件 - 可滚动 */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 0,
            scrollbarWidth: 'thin',
            scrollbarColor: '#c7c7cc transparent',
            '&::-webkit-scrollbar': {
              width: 6,
              backgroundColor: 'transparent'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#c7c7cc',
              borderRadius: 3
            }
          }}>
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
      </div>
      
      {/* 格式压缩对话框 */}
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
