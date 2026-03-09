import React, { useState } from 'react'
import { Modal, Button, Space, Card, InputNumber, Select, Input, message, Typography, Empty, Row, Col } from 'antd'
import { FolderOpenOutlined, DeleteOutlined, FolderOutlined } from '@ant-design/icons'
import type { ThumbnailOptions, ThumbnailResult } from '../../../types'
import { useToolOutputPathStore } from '../../../stores'

const { Text } = Typography

interface ThumbnailGenProps {
  visible: boolean
  onClose: () => void
}

interface ImageItem {
  path: string
  name: string
}

const ThumbnailGen: React.FC<ThumbnailGenProps> = ({ visible, onClose }) => {
  const [files, setFiles] = useState<ImageItem[]>([])
  const [width, setWidth] = useState(320)
  const [height, setHeight] = useState(240)
  const [fit, setFit] = useState<'cover' | 'contain' | 'fill'>('cover')
  const [format, setFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg')
  const [quality, setQuality] = useState(80)
  const [isProcessing, setIsProcessing] = useState(false)

  const { sharedOutputPath, setSharedOutputPath } = useToolOutputPathStore()
  const outputPath = sharedOutputPath

  const handleSelectFiles = async () => {
    if (window.electronAPI?.selectFiles) {
      const selected = await window.electronAPI.selectFiles('image')
      if (selected && selected.length > 0) {
        const newFiles = selected.map(path => ({
          path,
          name: path.split(/[/\\]/).pop() || ''
        }))
        setFiles(prev => [...prev, ...newFiles])
      }
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSelectOutputPath = async () => {
    if (window.electronAPI?.openDirectory) {
      const dir = await window.electronAPI.openDirectory()
      if (dir) {
        setSharedOutputPath(dir)
      }
    }
  }

  const handleExecute = async () => {
    if (files.length < 1) {
      message.warning('请先选择图片')
      return
    }

    setIsProcessing(true)

    try {
      const options: ThumbnailOptions = {
        width,
        height,
        fit,
        format,
        quality,
        outputDir: outputPath ? 'custom' : 'same',
        customOutputDir: outputPath || undefined,
        naming: 'suffix',
        suffix: '_thumb'
      }

      const results: ThumbnailResult[] = await window.electronAPI.generateThumbnails(
        files.map(f => f.path),
        options
      )

      const successCount = results.filter(r => r.success).length
      message.success(`生成完成：成功 ${successCount} 个，失败 ${results.length - successCount} 个`)
      onClose()
    } catch (error) {
      message.error('生成失败: ' + (error as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  const sizePresets = [
    { label: '320x240', value: { w: 320, h: 240 } },
    { label: '640x480', value: { w: 640, h: 480 } },
    { label: '800x600', value: { w: 800, h: 600 } },
    { label: '1024x768', value: { w: 1024, h: 768 } },
    { label: '1920x1080', value: { w: 1920, h: 1080 } },
  ]

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="缩略图生成"
      width={900}
      styles={{ body: { padding: '16px', overflow: 'hidden' } }}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button 
            type="primary" 
            onClick={handleExecute}
            disabled={files.length < 1 || isProcessing}
            loading={isProcessing}
          >
            {isProcessing ? '处理中...' : '生成缩略图'}
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 16, height: '60vh' }}>
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <Card size="small" title="选择图片">
            <Button 
              icon={<FolderOpenOutlined />} 
              onClick={handleSelectFiles}
              block
              style={{ marginBottom: 8 }}
            >
              添加图片
            </Button>
            <Text type="secondary">已选择: {files.length} 张图片</Text>
          </Card>

          <Card size="small" title="尺寸设置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Row gutter={8}>
                <Col span={12}>
                  <Text>宽度</Text>
                  <InputNumber 
                    value={width} 
                    onChange={v => setWidth(v || 320)} 
                    min={10} 
                    max={5000}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={12}>
                  <Text>高度</Text>
                  <InputNumber 
                    value={height} 
                    onChange={v => setHeight(v || 240)} 
                    min={10} 
                    max={5000}
                    style={{ width: '100%' }}
                  />
                </Col>
              </Row>
              <Select 
                placeholder="预设尺寸"
                style={{ width: '100%' }}
                onChange={val => {
                  setWidth(val.w)
                  setHeight(val.h)
                }}
                options={sizePresets.map(p => ({ ...p, value: p.value }))}
              />
              <div>
                <Text>适应模式</Text>
                <Select 
                  value={fit} 
                  onChange={setFit}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="cover">覆盖 (裁剪)</Select.Option>
                  <Select.Option value="contain">包含 (留白)</Select.Option>
                  <Select.Option value="fill">拉伸</Select.Option>
                </Select>
              </div>
            </Space>
          </Card>

          <Card size="small" title="输出格式">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select 
                value={format} 
                onChange={setFormat}
                style={{ width: '100%' }}
              >
                <Select.Option value="jpeg">JPEG</Select.Option>
                <Select.Option value="png">PNG</Select.Option>
                <Select.Option value="webp">WebP</Select.Option>
              </Select>
              <div>
                <Text>质量</Text>
                <InputNumber 
                  value={quality} 
                  onChange={v => setQuality(v || 80)} 
                  min={1} 
                  max={100}
                  style={{ width: '100%' }}
                />
              </div>
            </Space>
          </Card>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text strong>图片列表 ({files.length} 张)</Text>
            <Button 
              type="link" 
              icon={<FolderOutlined />} 
              onClick={handleSelectOutputPath}
              style={{ padding: 0 }}
            >
              {outputPath ? outputPath.split(/[/\\]/).pop() : '选择输出目录'}
            </Button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {files.length === 0 ? (
              <Empty description="请先添加图片" />
            ) : (
              <div style={{ padding: 8 }}>
                {files.map((file, index) => (
                  <Card
                    size="small"
                    key={index}
                    style={{ marginBottom: 8 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text ellipsis style={{ flex: 1, marginRight: 8 }}>
                        {file.name}
                      </Text>
                      <Button 
                        size="small" 
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveFile(index)}
                        danger
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ThumbnailGen
