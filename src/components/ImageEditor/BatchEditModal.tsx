import React from 'react'
import { Modal, Button, Space, message } from 'antd'
import EditorControls from './EditorControls'
import PresetsPanel from './PresetsPanel'
import { useImageEditor } from './useImageEditor'
import { imageLoader, logSignedInUserAction } from '../../utils'
import type { ImageEditSettings } from '../../types'

interface BatchEditModalProps {
  visible: boolean
  filePaths: string[]
  onClose: () => void
}

const BatchEditModal: React.FC<BatchEditModalProps> = ({ visible, filePaths, onClose }) => {
  const { settings, setSettings, updateSetting } = useImageEditor()

  const handleSettingsChange = (updates: Partial<ImageEditSettings>) => {
    Object.entries(updates).forEach(([key, value]) => {
      updateSetting(key as any, value)
    })
  }
  const handleApplyPreset = (presetSettings: ImageEditSettings) => {
    setSettings(presetSettings)
  }

  const handleBatchApply = async () => {
    if (filePaths.length === 0) {
      message.warning('没有选择任何文件')
      return
    }

    try {
      const api = window.electronAPI
      if (!api) throw new Error('electronAPI missing')
      const res = await api.applyEdits(filePaths, settings)
      console.log('[BatchEditModal] applyEdits result:', res)
      const failed = res.filter(r => !r.success)
      if (failed.length) {
        message.error(`部分图片处理失败：${failed.map(f => `${f.filePath}(${f.error || 'error'})`).join(',')}`)
      } else {
        message.success(`已生成 ${res.length} 张新图片，原文件均未修改`)
        logSignedInUserAction('image_editor_batch_apply', `批量编辑应用（${res.length} 张）`)
        res.forEach(r => {
          if (r.newPath) imageLoader.clearCache(r.newPath)
          imageLoader.clearCache(r.filePath)
        })
      }
    } catch (e: any) {
      console.error('[BatchEditModal] 批量处理出错', e)
      message.error(`批量处理出错：${e?.message || e}`)
    }
    onClose()
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="批量编辑图片"
      width={800}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleBatchApply}>应用到选中项</Button>
        </Space>
      }
    >
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <p>共 {filePaths.length} 张图片</p>
        </div>
        <div style={{ width: 320, borderLeft: '1px solid #eee' }}>
          <PresetsPanel layout="modal" onApply={handleApplyPreset} currentSettings={settings} />
          <EditorControls settings={settings} onChange={handleSettingsChange} />
        </div>
      </div>
    </Modal>
  )
}

export default BatchEditModal
