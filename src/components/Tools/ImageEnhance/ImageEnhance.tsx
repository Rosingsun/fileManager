import React, { useState } from 'react'
import { Modal, Button, Space, Card, Slider, Select, message, Typography, Empty, Switch, Radio } from 'antd'
import { FolderOpenOutlined, DeleteOutlined, ThunderboltOutlined, FolderOutlined } from '@ant-design/icons'
import type { EnhanceOptions } from '../../../types'
import { useToolOutputPathStore } from '../../../stores'

const { Text } = Typography

interface ImageEnhanceProps {
  visible: boolean
  onClose: () => void
}

interface ImageItem {
  path: string
  name: string
}

const ImageEnhance: React.FC<ImageEnhanceProps> = ({ visible, onClose }) => {
  const [files, setFiles] = useState<ImageItem[]>([])
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [autoExposure, setAutoExposure] = useState(true)
  const [autoDenoise, setAutoDenoise] = useState(true)
  const [autoSharpen, setAutoSharpen] = useState(true)
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [saturation, setSaturation] = useState(0)
  const [sharpness, setSharpness] = useState(0)
  const [denoise, setDenoise] = useState(0)
  const [scale, setScale] = useState<1 | 2 | 4>(1)
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

    if (!outputPath) {
      message.warning('请选择输出目录')
      return
    }

    setIsProcessing(true)

    try {
      const options: EnhanceOptions = {
        mode,
        auto: mode === 'auto' ? {
          exposure: autoExposure,
          denoise: autoDenoise,
          sharpen: autoSharpen
        } : undefined,
        manual: mode === 'manual' ? {
          brightness,
          contrast,
          saturation,
          sharpness,
          denoise
        } : undefined,
        scale: scale > 1 ? scale : undefined,
        outputPath
      }

      await window.electronAPI.enhanceImage(
        files[0].path,
        options
      )

      message.success('图片增强完成！')
      onClose()
    } catch (error) {
      message.error('增强失败: ' + (error as Error).message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="图片增强"
      width={900}
      styles={{ body: { padding: '16px', overflow: 'hidden' } }}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button 
            type="primary" 
            onClick={handleExecute}
            disabled={files.length < 1 || !outputPath || isProcessing}
            loading={isProcessing}
            icon={<ThunderboltOutlined />}
          >
            {isProcessing ? '处理中...' : '开始增强'}
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

          <Card size="small" title="增强模式">
            <Radio.Group 
              value={mode} 
              onChange={e => setMode(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <Radio value="auto">自动增强</Radio>
              <Radio value="manual">手动调整</Radio>
            </Radio.Group>
          </Card>

          {mode === 'auto' && (
            <Card size="small" title="自动增强选项">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>智能曝光</Text>
                  <Switch checked={autoExposure} onChange={setAutoExposure} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>降噪</Text>
                  <Switch checked={autoDenoise} onChange={setAutoDenoise} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>锐化</Text>
                  <Switch checked={autoSharpen} onChange={setAutoSharpen} />
                </div>
              </Space>
            </Card>
          )}

          {mode === 'manual' && (
            <Card size="small" title="手动调整">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text>亮度: {brightness}</Text>
                  <Slider 
                    value={brightness} 
                    onChange={setBrightness}
                    min={-100}
                    max={100}
                  />
                </div>
                <div>
                  <Text>对比度: {contrast}</Text>
                  <Slider 
                    value={contrast} 
                    onChange={setContrast}
                    min={-100}
                    max={100}
                  />
                </div>
                <div>
                  <Text>饱和度: {saturation}</Text>
                  <Slider 
                    value={saturation} 
                    onChange={setSaturation}
                    min={-100}
                    max={100}
                  />
                </div>
                <div>
                  <Text>锐度: {sharpness}</Text>
                  <Slider 
                    value={sharpness} 
                    onChange={setSharpness}
                    min={-100}
                    max={100}
                  />
                </div>
                <div>
                  <Text>降噪: {denoise}</Text>
                  <Slider 
                    value={denoise} 
                    onChange={setDenoise}
                    min={-100}
                    max={100}
                  />
                </div>
              </Space>
            </Card>
          )}

          <Card size="small" title="超分辨率">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>放大倍数</Text>
              <Select 
                value={scale} 
                onChange={setScale}
                style={{ width: '100%' }}
              >
                <Select.Option value={1}>不放大</Select.Option>
                <Select.Option value={2}>2倍</Select.Option>
                <Select.Option value={4}>4倍</Select.Option>
              </Select>
            </Space>
          </Card>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong>图片列表 ({files.length} 张)</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>（图片增强建议逐张处理）</Text>
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
            {files.length === 0 ? (
              <Empty description="请先添加图片" />
            ) : (
              <div style={{ padding: 8 }}>
                {files.map((file, index) => (
                  <Card
                    size="small"
                    key={index}
                    style={{ marginBottom: 8, width: '100%' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img
                          src={`file:///${file.path.replace(/\\/g, '/')}`}
                          alt={file.name}
                          style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4 }}
                        />
                        <Text ellipsis style={{ maxWidth: 260 }}>{file.name}</Text>
                      </div>
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

export default ImageEnhance
