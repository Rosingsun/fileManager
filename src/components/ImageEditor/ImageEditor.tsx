import React, { useState, useEffect } from 'react'
import { Modal, Button, Space } from 'antd'
import EditorControls from './EditorControls'
import PresetsPanel from './PresetsPanel'
import FormatCompressDialog from './FormatCompressDialog'
import { useImageEditor } from './useImageEditor'
import { getFilterCss } from '../../utils/imageEditorUtils'
import type { ImageEditSettings } from '../../types'

interface ImageEditorProps {
  visible: boolean
  filePath: string
  onClose: () => void
  onSaved?: (result: { success: boolean; filePath: string }) => void
}

const ImageEditor: React.FC<ImageEditorProps> = ({ visible, filePath, onClose, onSaved }) => {
  const { settings, setSettings, updateSetting, resetSettings } = useImageEditor()

  const handleSettingsChange = (updates: Partial<ImageEditSettings>) => {
    Object.entries(updates).forEach(([key, value]) => {
      updateSetting(key as any, value)
    })
  }
  const [openFormatDialog, setOpenFormatDialog] = useState(false)

  useEffect(() => {
    if (!visible) {
      resetSettings()
    }
  }, [visible])

  const handleApplyPreset = (presetSettings: ImageEditSettings) => {
    setSettings(presetSettings)
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
      width={800}
      footer={
        <Space>
          <Button onClick={() => setOpenFormatDialog(true)}>格式/压缩</Button>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>保存</Button>
        </Space>
      }
    >
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <img
            src={`file://${filePath}`}
            alt="preview"
            style={{
              maxWidth: '100%',
              maxHeight: '500px',
              filter: getFilterCss(settings)
            }}
          />
        </div>
        <div style={{ width: 320, borderLeft: '1px solid #eee' }}>
          <PresetsPanel onApply={handleApplyPreset} currentSettings={settings} />
          <EditorControls settings={settings} onChange={handleSettingsChange} />
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
