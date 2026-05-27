import React, { useState, useEffect } from 'react'
import { Modal, Select, Slider, InputNumber, Space, Button, Typography, Switch, Input, Collapse } from 'antd'
import type { FormatConversionOptions, CompressionOptions, ImageEditSettings, WatermarkOptions } from '../../types'

interface FormatCompressDialogProps {
  visible: boolean
  files: string[]
  onClose: () => void
  onConvert: (options: FormatConversionOptions) => void
  onCompress: (options: CompressionOptions) => void
  /** 编辑器内导出时附带当前调整 */
  editSettings?: ImageEditSettings
}

const { Text } = Typography

const FormatCompressDialog: React.FC<FormatCompressDialogProps> = ({
  visible,
  files,
  onClose,
  onConvert,
  onCompress,
  editSettings,
}) => {
  const [format, setFormat] = useState<string>('jpeg')
  const [quality, setQuality] = useState<number>(80)
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null)
  const [scalePercent, setScalePercent] = useState<number>(100)
  const [enableResize, setEnableResize] = useState(false)
  const [watermarkEnabled, setWatermarkEnabled] = useState(false)
  const [wmText, setWmText] = useState('')
  const [wmOpacity, setWmOpacity] = useState(60)
  const [wmPosition, setWmPosition] = useState<WatermarkOptions['position']>('bottom-right')

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

  const buildExportOptions = (): FormatConversionOptions => {
    const opts: FormatConversionOptions = {
      targetFormat: format,
      quality,
    }
    if (editSettings) opts.editSettings = editSettings
    if (enableResize && scalePercent > 0 && scalePercent < 100) {
      opts.scalePercent = scalePercent
    }
    if (watermarkEnabled && wmText.trim()) {
      opts.watermark = {
        type: 'text',
        text: {
          content: wmText.trim(),
          fontSize: 24,
          fontFamily: 'sans-serif',
          color: '#ffffff',
          opacity: wmOpacity / 100,
        },
        position: wmPosition,
        margin: 16,
      }
    }
    return opts
  }

  const handleConvert = () => {
    onConvert(buildExportOptions())
  }

  const handleCompress = () => {
    onCompress({ qualityPercentage: quality })
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="导出 / 格式 / 压缩"
      footer={null}
      width={440}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Text>目标格式</Text>
          <Select value={format} onChange={v => setFormat(v)} style={{ width: '100%', marginTop: 8 }}>
            <Select.Option value="jpeg">JPEG</Select.Option>
            <Select.Option value="png">PNG</Select.Option>
            <Select.Option value="webp">WebP</Select.Option>
            <Select.Option value="bmp">BMP</Select.Option>
            <Select.Option value="tiff">TIFF</Select.Option>
          </Select>
        </div>

        <div>
          <Text>质量 / 压缩</Text>
          <Slider min={1} max={100} value={quality} onChange={setQuality} />
          <InputNumber min={1} max={100} value={quality} onChange={v => setQuality(v || 1)} style={{ width: '100%' }} />
        </div>

        {estimatedSize != null && (
          <Text type="secondary">预估大小（仅压缩参考）：{(estimatedSize / 1024).toFixed(1)} KB</Text>
        )}

        <Collapse
          ghost
          items={[
            {
              key: 'resize',
              label: '导出尺寸',
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <label className="editor-export-option-row">
                    <span>缩放输出</span>
                    <Switch checked={enableResize} onChange={setEnableResize} />
                  </label>
                  {enableResize ? (
                    <>
                      <Slider
                        min={10}
                        max={100}
                        value={scalePercent}
                        onChange={setScalePercent}
                        tooltip={{ formatter: v => `${v}%` }}
                      />
                      <Text type="secondary">相对原图最长边 {scalePercent}%</Text>
                    </>
                  ) : (
                    <Text type="secondary">保持原始像素尺寸</Text>
                  )}
                </Space>
              ),
            },
            {
              key: 'watermark',
              label: '文字水印',
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <label className="editor-export-option-row">
                    <span>导出时添加</span>
                    <Switch checked={watermarkEnabled} onChange={setWatermarkEnabled} />
                  </label>
                  {watermarkEnabled ? (
                    <>
                      <Input
                        placeholder="水印文字"
                        value={wmText}
                        onChange={e => setWmText(e.target.value)}
                        maxLength={64}
                      />
                      <div>
                        <Text type="secondary">位置</Text>
                        <Select
                          value={wmPosition}
                          onChange={setWmPosition}
                          style={{ width: '100%', marginTop: 4 }}
                          options={[
                            { value: 'bottom-right', label: '右下' },
                            { value: 'bottom-left', label: '左下' },
                            { value: 'top-right', label: '右上' },
                            { value: 'top-left', label: '左上' },
                            { value: 'middle-center', label: '居中' },
                          ]}
                        />
                      </div>
                      <div>
                        <Text type="secondary">不透明度 {wmOpacity}%</Text>
                        <Slider min={10} max={100} value={wmOpacity} onChange={setWmOpacity} />
                      </div>
                    </>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />

        {editSettings ? (
          <Text type="secondary" className="editor-export-hint">
            将应用当前编辑器中的全部调整参数后导出
          </Text>
        ) : null}

        <Space>
          <Button type="primary" onClick={handleConvert}>
            转换并导出
          </Button>
          <Button type="default" onClick={handleCompress}>
            仅压缩
          </Button>
        </Space>
      </Space>
    </Modal>
  )
}

export default FormatCompressDialog
