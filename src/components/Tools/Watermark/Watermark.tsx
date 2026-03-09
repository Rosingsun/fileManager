import React, { useState } from 'react'
import { Modal, Button, Space, Card, Input, InputNumber, Select, message, Typography, Empty, Radio } from 'antd'
import { FolderOpenOutlined, DeleteOutlined, FolderOutlined, EyeOutlined } from '@ant-design/icons'
import type { WatermarkOptions } from '../../../types'
import ImageViewer from '../../ImageViewer/ImageViewer'
import { useToolOutputPathStore } from '../../../stores'

const { Text } = Typography

interface WatermarkProps {
  visible: boolean
  onClose: () => void
}

interface ImageItem {
  path: string
  name: string
}

type WatermarkPosition = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

const Watermark: React.FC<WatermarkProps> = ({ visible, onClose }) => {
  const [images, setImages] = useState<ImageItem[]>([])
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text')
  const [textContent, setTextContent] = useState('水印文字')
  const [fontSize, setFontSize] = useState(48)
  const [fontColor, setFontColor] = useState('#ffffff')
  const [opacity, setOpacity] = useState(50)
  const [position, setPosition] = useState<WatermarkPosition>('bottom-right')
  const [margin, setMargin] = useState(20)
  const [tile, setTile] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)

  const { sharedOutputPath, setSharedOutputPath } = useToolOutputPathStore()
  const outputPath = sharedOutputPath

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

  const handleSelectOutputPath = async () => {
    if (window.electronAPI?.openDirectory) {
      const dir = await window.electronAPI.openDirectory()
      if (dir) {
        setSharedOutputPath(dir)
      }
    }
  }

  const handleExecute = async () => {
    if (images.length < 1) {
      message.warning('请先选择图片')
      return
    }

    if (watermarkType === 'text' && !textContent) {
      message.warning('请输入水印文字')
      return
    }

    if (!outputPath) {
      message.warning('请选择输出目录')
      return
    }

    setIsProcessing(true)

    try {
      const options: WatermarkOptions = {
        type: watermarkType,
        text: watermarkType === 'text' ? {
          content: textContent,
          fontSize,
          fontFamily: 'Arial',
          color: fontColor,
          opacity: opacity / 100
        } : undefined,
        position,
        margin,
        tile
      }

      const results = await window.electronAPI.addWatermark(
        images.map(img => img.path),
        options
      )

      const successCount = results.filter(r => r.success).length
      message.success(`添加水印完成：成功 ${successCount} 个，失败 ${results.length - successCount} 个`)
      onClose()
    } catch (error) {
      message.error('添加水印失败: ' + (error as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePreview = async (index: number) => {
    if (images.length < 1) {
      message.warning('请先添加图片')
      return
    }

    if (watermarkType === 'text' && !textContent) {
      message.warning('请输入水印文字')
      return
    }

    setPreviewIndex(index)
    setIsGeneratingPreview(true)

    try {
      const options: WatermarkOptions = {
        type: watermarkType,
        text: watermarkType === 'text' ? {
          content: textContent,
          fontSize,
          fontFamily: 'Arial',
          color: fontColor,
          opacity: opacity / 100
        } : undefined,
        position,
        margin,
        tile
      }

      const previewUrl = await window.electronAPI.previewWatermark(images[index].path, options)
      setPreviewImage(previewUrl)
    } catch (error) {
      message.error('生成预览失败: ' + (error as Error).message)
    } finally {
      setIsGeneratingPreview(false)
    }
  }

  const handleClosePreview = () => {
    setPreviewImage(null)
  }

  const positionOptions = [
    { value: 'top-left', label: '左上' },
    { value: 'top-center', label: '上中' },
    { value: 'top-right', label: '右上' },
    { value: 'middle-left', label: '左中' },
    { value: 'middle-center', label: '居中' },
    { value: 'middle-right', label: '右中' },
    { value: 'bottom-left', label: '左下' },
    { value: 'bottom-center', label: '下中' },
    { value: 'bottom-right', label: '右下' },
  ]

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="添加水印"
      width={900}
      styles={{ body: { padding: '16px', overflow: 'hidden' } }}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button 
            type="primary" 
            onClick={handleExecute}
            disabled={images.length < 1 || !outputPath || isProcessing}
            loading={isProcessing}
          >
            {isProcessing ? '处理中...' : '添加水印'}
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

          <Card size="small" title="水印类型">
            <Radio.Group 
              value={watermarkType} 
              onChange={e => setWatermarkType(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <Radio value="text">文字水印</Radio>
              <Radio value="image">图片水印</Radio>
            </Radio.Group>
          </Card>

          {watermarkType === 'text' && (
            <Card size="small" title="文字设置">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input 
                  placeholder="水印文字"
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                />
                <div>
                  <Text>字体大小</Text>
                  <InputNumber 
                    value={fontSize} 
                    onChange={v => setFontSize(v || 48)} 
                    min={12} 
                    max={200}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <Text>字体颜色</Text>
                  <input 
                    type="color" 
                    value={fontColor}
                    onChange={e => setFontColor(e.target.value)}
                    style={{ width: '100%', height: 30, cursor: 'pointer' }}
                  />
                </div>
              </Space>
            </Card>
          )}

          <Card size="small" title="位置设置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select 
                value={position} 
                onChange={setPosition}
                style={{ width: '100%' }}
                options={positionOptions}
              />
              <div>
                <Text>边距</Text>
                <InputNumber 
                  value={margin} 
                  onChange={v => setMargin(v || 0)} 
                  min={0} 
                  max={100}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <Text>透明度</Text>
                <InputNumber 
                  value={opacity} 
                  onChange={v => setOpacity(v || 50)} 
                  min={0} 
                  max={100}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <input 
                  type="checkbox" 
                  checked={tile} 
                  onChange={e => setTile(e.target.checked)}
                />
                <Text style={{ marginLeft: 8 }}>平铺水印</Text>
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
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                        {img.name}
                      </Text>
                      <Space size="small">
                        <Button 
                          size="small" 
                          icon={<EyeOutlined />}
                          onClick={() => handlePreview(index)}
                          loading={isGeneratingPreview && previewIndex === index}
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
        </div>
      </div>

      {previewImage && (
        <ImageViewer
          images={[{ id: 'preview', url: previewImage, filename: '预览', width: 0, height: 0, size: 0, format: 'jpeg', createdAt: '', modifiedAt: '' }]}
          currentIndex={0}
          onClose={handleClosePreview}
        />
      )}
    </Modal>
  )
}

export default Watermark
