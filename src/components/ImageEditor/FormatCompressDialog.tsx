import React, { useState, useEffect } from 'react'
import { Modal, Select, Slider, InputNumber, Space, Button, Typography } from 'antd'
import type { FormatConversionOptions, CompressionOptions } from '../../types'

interface FormatCompressDialogProps {
  visible: boolean
  files: string[]
  onClose: () => void
  onConvert: (options: FormatConversionOptions) => void
  onCompress: (options: CompressionOptions) => void
}

const { Text } = Typography

const FormatCompressDialog: React.FC<FormatCompressDialogProps> = ({ visible, files, onClose, onConvert, onCompress }) => {
  const [format, setFormat] = useState<string>('jpeg')
  const [quality, setQuality] = useState<number>(80)
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null)

  useEffect(() => {
    if (files.length === 1 && estimatedSize !== null) {
      const api = window.electronAPI
      if (api) {
        api.estimateCompressedSize(files[0], { qualityPercentage: quality }).then(size => {
          setEstimatedSize(size)
        }).catch(() => setEstimatedSize(null))
      }
    } else {
      setEstimatedSize(null)
    }
  }, [quality, files])

  const handleConvert = () => {
    onConvert({ targetFormat: format, quality })
  }

  const handleCompress = () => {
    onCompress({ qualityPercentage: quality })
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="格式转换 / 压缩"
      footer={null}
    >
      <div>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text>目标格式：</Text>
            <Select value={format} onChange={v => setFormat(v)} style={{ width: 120 }}>
              <Select.Option value="jpeg">JPEG</Select.Option>
              <Select.Option value="png">PNG</Select.Option>
              <Select.Option value="webp">WebP</Select.Option>
              <Select.Option value="bmp">BMP</Select.Option>
              <Select.Option value="tiff">TIFF</Select.Option>
            </Select>
          </div>
          <div>
            <Text>质量/压缩百分比：</Text>
            <Slider min={1} max={100} value={quality} onChange={setQuality} />
            <InputNumber min={1} max={100} value={quality} onChange={v => setQuality(v || 1)} />
          </div>
          {estimatedSize != null && (
            <div>
              <Text>预估大小: {(estimatedSize / 1024).toFixed(1)} KB</Text>
            </div>
          )}
          <Space>
            <Button type="primary" onClick={handleConvert}>转换格式</Button>
            <Button type="primary" onClick={handleCompress}>压缩</Button>
          </Space>
        </Space>
      </div>
    </Modal>
  )
}

export default FormatCompressDialog
