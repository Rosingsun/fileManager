import React, { useState } from 'react'
import { Modal, Button, Space, Card, Select, InputNumber, message, Typography, Empty } from 'antd'
import { FolderOpenOutlined, DeleteOutlined, FolderOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import type { FormatConversionOptions } from '../../../types'
import { useToolOutputPathStore } from '../../../stores'

const { Text } = Typography

interface ImageFormatConverterProps {
  visible: boolean
  onClose: () => void
}

interface ImageItem {
  path: string
  name: string
}

const ImageFormatConverter: React.FC<ImageFormatConverterProps> = ({ visible, onClose }) => {
  const [images, setImages] = useState<ImageItem[]>([])
  const [targetFormat, setTargetFormat] = useState<'jpeg' | 'png' | 'webp' | 'bmp' | 'tiff' | 'pdf'>('jpeg')
  const [quality, setQuality] = useState(80)
  const [isProcessing, setIsProcessing] = useState(false)

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
        setSharedOutputPath(dir)
      }
    }
  }

  const handleExecute = async () => {
    if (images.length < 1) {
      message.warning('请至少选择1张图片')
      return
    }

    if (!outputPath) {
      message.warning('请选择输出目录')
      return
    }

    setIsProcessing(true)

    try {
      if (targetFormat === 'pdf') {
        // 转为一个 PDF 文档
        const pdfOptions = {
          pageSize: 'a4',
          orientation: 'auto',
          margin: 10,
          imagesPerPage: 'auto',
          outputPath
        }
        const pdfPath = await window.electronAPI.imagesToPdf(
          images.map(img => img.path),
          pdfOptions
        )
        message.success(`PDF 已生成: ${pdfPath}`)
        onClose()
      } else {
        const options: FormatConversionOptions = {
          targetFormat,
          quality
        }

        const result = await window.electronAPI.convertFormat(
          images.map(img => img.path),
          options,
          outputPath
        )

        const successCount = result.filter(r => r.success).length
        const errorCount = result.filter(r => !r.success).length
        const errors = result.filter(r => !r.success)
        if (successCount > 0) {
          message.success(`成功转换 ${successCount} 张图片！${errorCount > 0 ? `失败 ${errorCount} 张` : ''}`)
          // 显示详细错误信息
          errors.forEach(err => {
            console.error(`转换失败: ${err.filePath} - ${err.error}`)
          })
          onClose()
        } else {
          // 显示详细错误信息
          const errorMessages = errors.map(err => `${err.filePath}: ${err.error}`).join('\n')
          message.error(`转换失败: ${errorCount} 张图片\n${errorMessages}`)
        }
      }
    } catch (error) {
      message.error('转换失败: ' + (error as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="图片类型转换"
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
            {isProcessing ? '处理中...' : '开始转换'}
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

          <Card size="small" title="输出格式">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text>目标格式</Text>
                <Select 
                  value={targetFormat} 
                  onChange={setTargetFormat}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="jpeg">JPEG</Select.Option>
                  <Select.Option value="png">PNG</Select.Option>
                  <Select.Option value="webp">WebP</Select.Option>
                  <Select.Option value="bmp">BMP</Select.Option>
                  <Select.Option value="tiff">TIFF</Select.Option>
                  <Select.Option value="pdf">PDF</Select.Option>
                </Select>
                {targetFormat === 'pdf' && (
                  <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                    图片会按列表顺序合并为一个 PDF 文件
                  </Text>
                )}
              </div>
              {targetFormat !== 'pdf' && (
                <div>
                  <Text>输出质量 ({quality}%)</Text>
                  <InputNumber 
                    value={quality} 
                    onChange={v => setQuality(v || 80)} 
                    min={1} 
                    max={100}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </Space>
          </Card>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong>图片列表 ({images.length} 张)</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>（拖拽调整顺序）</Text>
            </div>
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
                      style={{ marginBottom: 8, width: '100%' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minWidth: 0 }}>
                          <img
                            src={`file:///${img.path.replace(/\\/g, '/')}`}
                            alt={img.name}
                            style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4 }}
                          />
                          <Text ellipsis style={{ maxWidth: '60%', minWidth: 0 }}>{index + 1}. {img.name}</Text>
                        </div>
                        <Space size="small">
                          <Button size="small" icon={<ArrowUpOutlined />} onClick={() => handleMoveImage(index, 'up')} disabled={index === 0} />
                          <Button size="small" icon={<ArrowDownOutlined />} onClick={() => handleMoveImage(index, 'down')} disabled={index === images.length - 1} />
                          <Button size="small" icon={<DeleteOutlined />} onClick={() => handleRemoveImage(index)} danger />
                        </Space>
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

export default ImageFormatConverter
