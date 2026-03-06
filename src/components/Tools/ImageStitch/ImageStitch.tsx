import React, { useState, useMemo } from 'react'
import { Modal, Button, Space, Card, Select, InputNumber, Radio, message, Typography, Row, Col, Empty } from 'antd'
import { FolderOpenOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import type { StitchOptions } from '../../../types'

const { Text } = Typography

interface ImageStitchProps {
  visible: boolean
  onClose: () => void
}

interface ImageItem {
  path: string
  name: string
}

const ImageStitch: React.FC<ImageStitchProps> = ({ visible, onClose }) => {
  const [images, setImages] = useState<ImageItem[]>([])
  const [mode, setMode] = useState<'horizontal' | 'vertical' | 'grid'>('horizontal')
  const [rows, setRows] = useState(2)
  const [cols, setCols] = useState(2)
  const [gap, setGap] = useState(0)
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [align, setAlign] = useState<'start' | 'center' | 'end'>('center')
  const [outputFormat, setOutputFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg')
  const [quality, setQuality] = useState(90)
  const [outputPath, setOutputPath] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSelectImages = async () => {
    if (window.electronAPI?.selectFiles) {
      const selected = await window.electronAPI.selectFiles('image')
      if (selected && selected.length > 0) {
        const newImages = selected.map(path => ({
          path,
          name: path.split(/[/\\]/).pop() || ''
        }))
        setImages(prev => [...prev, ...newImages])
      }
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newImages = [...images]
      ;[newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]]
      setImages(newImages)
    } else if (direction === 'down' && index < images.length - 1) {
      const newImages = [...images]
      ;[newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]]
      setImages(newImages)
    }
  }

  const handleSelectOutputPath = async () => {
    if (window.electronAPI?.openDirectory) {
      const dir = await window.electronAPI.openDirectory()
      if (dir) {
        setOutputPath(dir)
      }
    }
  }

  const handleExecute = async () => {
    if (images.length < 2) {
      message.warning('请至少选择2张图片')
      return
    }

    if (!outputPath) {
      message.warning('请选择输出目录')
      return
    }

    if (mode === 'grid' && rows * cols < images.length) {
      message.warning(`网格布局(${rows}x${cols})空间不足，请调整行列数`)
      return
    }

    setIsProcessing(true)

    try {
      const options: StitchOptions = {
        mode,
        rows: mode === 'grid' ? rows : undefined,
        cols: mode === 'grid' ? cols : undefined,
        gap,
        backgroundColor,
        align,
        outputFormat,
        quality
      }

      const result = await window.electronAPI.stitchImages(
        images.map(img => img.path),
        options
      )

      if (result) {
        message.success('拼接成功！')
        onClose()
      }
    } catch (error) {
      message.error('拼接失败: ' + (error as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  const gridPreview = useMemo(() => {
    if (mode !== 'grid') return null
    
    const cells = []
    for (let i = 0; i < rows * cols; i++) {
      const img = images[i]
      cells.push(
        <div
          key={i}
          style={{
            width: '100%',
            height: 80,
            background: img ? '#f0f0f0' : '#fafafa',
            border: '1px dashed #d9d9d9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4
          }}
        >
          {img ? (
            <Text ellipsis style={{ fontSize: 12 }}>{img.name}</Text>
          ) : (
            <Text type="secondary">空白</Text>
          )}
        </div>
      )
    }
    return cells
  }, [images, mode, rows, cols])

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="图片拼接"
      width={900}
      styles={{ body: { padding: '16px', overflow: 'hidden' } }}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button 
            type="primary" 
            onClick={handleExecute}
            disabled={images.length < 2 || !outputPath || isProcessing}
            loading={isProcessing}
          >
            {isProcessing ? '处理中...' : '开始拼接'}
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 16, height: '60vh' }}>
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <Card size="small" title="选择图片">
            <Button 
              icon={<FolderOpenOutlined />} 
              onClick={handleSelectImages}
              block
              style={{ marginBottom: 8 }}
            >
              添加图片
            </Button>
            <Text type="secondary">已选择: {images.length} 张图片</Text>
          </Card>

          <Card size="small" title="拼接模式">
            <Radio.Group 
              value={mode} 
              onChange={e => setMode(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <Radio value="horizontal">横向拼接</Radio>
              <Radio value="vertical">纵向拼接</Radio>
              <Radio value="grid">网格拼接</Radio>
            </Radio.Group>
          </Card>

          {mode === 'grid' && (
            <Card size="small">
              <Row gutter={8}>
                <Col span={12}>
                  <Text>行数</Text>
                  <InputNumber 
                    value={rows} 
                    onChange={v => setRows(v || 2)} 
                    min={1} 
                    max={10}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={12}>
                  <Text>列数</Text>
                  <InputNumber 
                    value={cols} 
                    onChange={v => setCols(v || 2)} 
                    min={1} 
                    max={10}
                    style={{ width: '100%' }}
                  />
                </Col>
              </Row>
            </Card>
          )}

          <Card size="small" title="外观设置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text>间距</Text>
                <InputNumber 
                  value={gap} 
                  onChange={v => setGap(v || 0)} 
                  min={0} 
                  max={100}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <Text>背景色</Text>
                <input 
                  type="color" 
                  value={backgroundColor}
                  onChange={e => setBackgroundColor(e.target.value)}
                  style={{ width: '100%', height: 30, cursor: 'pointer' }}
                />
              </div>
              <div>
                <Text>对齐</Text>
                <Select 
                  value={align} 
                  onChange={setAlign}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="start">顶部/左侧</Select.Option>
                  <Select.Option value="center">居中</Select.Option>
                  <Select.Option value="end">底部/右侧</Select.Option>
                </Select>
              </div>
            </Space>
          </Card>

          <Card size="small" title="输出设置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select 
                value={outputFormat} 
                onChange={setOutputFormat}
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
                  onChange={v => setQuality(v || 90)} 
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
            <Text strong>图片列表 ({images.length} 张)</Text>
            <Button 
              type="link" 
              icon={<FolderOutlined />} 
              onClick={handleSelectOutputPath}
              style={{ padding: 0 }}
            >
              {outputPath ? outputPath.split(/[/\\]/).pop() : '选择输出目录'}
            </Button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 6 }}>
            {images.length === 0 ? (
              <Empty description="请先添加图片" />
            ) : (
              <div style={{ padding: 8 }}>
                {images.map((img, index) => (
                  <Card
                    size="small"
                    key={index}
                    style={{ marginBottom: 8 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text ellipsis style={{ flex: 1, marginRight: 8 }}>
                        {index + 1}. {img.name}
                      </Text>
                      <Space>
                        <Button 
                          size="small" 
                          icon={<ArrowUpOutlined />}
                          onClick={() => handleMoveImage(index, 'up')}
                          disabled={index === 0}
                        />
                        <Button 
                          size="small" 
                          icon={<ArrowDownOutlined />}
                          onClick={() => handleMoveImage(index, 'down')}
                          disabled={index === images.length - 1}
                        />
                        <Button 
                          size="small" 
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveImage(index)}
                          danger
                        />
                      </Space>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {mode === 'grid' && gridPreview && (
            <div style={{ marginTop: 12 }}>
              <Text strong>网格预览</Text>
              <Row gutter={gap} style={{ marginTop: 8 }}>
                {gridPreview.map((cell, i) => (
                  <Col key={i} span={24 / cols}>
                    {cell}
                  </Col>
                ))}
              </Row>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default ImageStitch
