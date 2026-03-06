import React, { useState } from 'react'
import { Modal, Button, Space, Card, Select, InputNumber, Radio, message, Typography, Empty } from 'antd'
import { FolderOpenOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import type { PdfOptions } from '../../../types'

const { Text } = Typography

interface ImageToPdfProps {
  visible: boolean
  onClose: () => void
}

interface ImageItem {
  path: string
  name: string
}

const ImageToPdf: React.FC<ImageToPdfProps> = ({ visible, onClose }) => {
  const [images, setImages] = useState<ImageItem[]>([])
  const [pageSize, setPageSize] = useState<'a4' | 'a3' | 'letter' | 'original'>('a4')
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto')
  const [margin, setMargin] = useState(10)
  const [imagesPerPage, setImagesPerPage] = useState<number | 'auto'>('auto')
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
      const options: PdfOptions = {
        pageSize,
        orientation,
        margin,
        imagesPerPage,
        outputPath
      }

      const result = await window.electronAPI.imagesToPdf(
        images.map(img => img.path),
        options
      )

      if (result) {
        message.success('PDF创建成功！')
        onClose()
      }
    } catch (error) {
      message.error('创建失败: ' + (error as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="图片转PDF"
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
            {isProcessing ? '处理中...' : '创建PDF'}
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

          <Card size="small" title="页面设置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text>页面尺寸</Text>
                <Select 
                  value={pageSize} 
                  onChange={setPageSize}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="a4">A4</Select.Option>
                  <Select.Option value="a3">A3</Select.Option>
                  <Select.Option value="letter">Letter</Select.Option>
                  <Select.Option value="original">原图尺寸</Select.Option>
                </Select>
              </div>
              <div>
                <Text>页面方向</Text>
                <Select 
                  value={orientation} 
                  onChange={setOrientation}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="auto">自动</Select.Option>
                  <Select.Option value="portrait">纵向</Select.Option>
                  <Select.Option value="landscape">横向</Select.Option>
                </Select>
              </div>
              <div>
                <Text>页边距 (mm)</Text>
                <InputNumber 
                  value={margin} 
                  onChange={v => setMargin(v || 0)} 
                  min={0} 
                  max={50}
                  style={{ width: '100%' }}
                />
              </div>
            </Space>
          </Card>

          <Card size="small" title="图片排列">
            <Select 
              value={imagesPerPage} 
              onChange={setImagesPerPage}
              style={{ width: '100%' }}
            >
              <Select.Option value="auto">自动适应</Select.Option>
              <Select.Option value={1}>每页1张</Select.Option>
              <Select.Option value={2}>每页2张</Select.Option>
              <Select.Option value={4}>每页4张</Select.Option>
              <Select.Option value={6}>每页6张</Select.Option>
            </Select>
          </Card>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong>图片列表 ({images.length} 张)</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>（拖拽调整页面顺序）</Text>
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
                        第 {index + 1} 页: {img.name}
                      </Text>
                      <Space size="small">
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
        </div>
      </div>
    </Modal>
  )
}

export default ImageToPdf
