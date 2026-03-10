import React, { useState } from 'react'
import { Modal, Button, Space, message } from 'antd'
import EditorControls from './EditorControls'
import PresetsPanel from './PresetsPanel'
import FormatCompressDialog from './FormatCompressDialog'
import { useImageEditor } from './useImageEditor'
import { imageLoader } from '../../utils'
import type { ImageEditSettings, FormatConversionOptions, CompressionOptions } from '../../types'

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
  const [formatDialog, setFormatDialog] = useState(false)

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
        const moved = res.filter(r => r.success && r.newPath)
        if (moved.length) {
          message.success(`部分文件另存为：${moved.map(m => m.newPath).join(',')}`)
          moved.forEach(m => imageLoader.clearCache(m.newPath || ''))
        } else {
          message.success('批量应用完成')
        }
        // 清理所有原图片的缓存
        filePaths.forEach(p => imageLoader.clearCache(p))
      }
    } catch (e: any) {
      console.error('[BatchEditModal] 批量处理出错', e)
      message.error(`批量处理出错：${e?.message || e}`)
    }
    onClose()
  }

  const handleBatchConvert = (opts: FormatConversionOptions) => {
    const api = window.electronAPI
    if (api) {
      api.convertFormat(filePaths, opts).then(results => {
        const failed = results.filter(r => !r.success)
        if (failed.length) message.error('部分转换失败')
        else message.success('格式转换完成')
        setFormatDialog(false)
        onClose()
      })
    }
  }

  const handleBatchCompress = (opts: CompressionOptions) => {
    const api = window.electronAPI
    if (api) {
      api.compressImage(filePaths, opts).then(results => {
        const failed = results.filter(r => !r.success)
        if (failed.length) message.error('部分压缩失败')
        else message.success('压缩完成')
        setFormatDialog(false)
        onClose()
      })
    }
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="批量编辑图片"
      width={800}
      footer={
        <Space>
          <Button onClick={() => setFormatDialog(true)}>格式/压缩</Button>
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
          <PresetsPanel onApply={handleApplyPreset} currentSettings={settings} />
          <EditorControls settings={settings} onChange={handleSettingsChange} />
        </div>
      </div>
      <FormatCompressDialog
        visible={formatDialog}
        files={filePaths}
        onClose={() => setFormatDialog(false)}
        onConvert={handleBatchConvert}
        onCompress={handleBatchCompress}
      />
    </Modal>
  )
}

export default BatchEditModal
