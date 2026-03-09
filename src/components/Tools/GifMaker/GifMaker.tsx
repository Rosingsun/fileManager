import React, { useState } from 'react'
import { Modal, Button, Space, Card, InputNumber, Select, message, Typography, Empty, Slider } from 'antd'
import { FolderOpenOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, FolderOutlined } from '@ant-design/icons'
import type { GifFrame, GifOptions } from '../../../types'
import { useToolOutputPathStore } from '../../../stores'

const { Text } = Typography

interface GifMakerProps {
  visible: boolean
  onClose: () => void
}

interface FrameItem {
  path: string
  name: string
  delay: number
}

const GifMaker: React.FC<GifMakerProps> = ({ visible, onClose }) => {
  const [frames, setFrames] = useState<FrameItem[]>([])
  const [width, setWidth] = useState<number | undefined>(undefined)
  const [height, setHeight] = useState<number | undefined>(undefined)
  const [delay, setDelay] = useState(200)
  const [loop, setLoop] = useState(0)
  const [quality, setQuality] = useState(10)
  const [isProcessing, setIsProcessing] = useState(false)

  const { sharedOutputPath, setSharedOutputPath } = useToolOutputPathStore()
  const outputPath = sharedOutputPath

  const handleSelectFrames = async () => {
    if (window.electronAPI?.selectFiles) {
      const selected = await window.electronAPI.selectFiles('image')
      if (selected && selected.length > 0) {
        const newFrames = selected.map(path => ({
          path,
          name: path.split(/[/\\]/).pop() || '',
          delay
        }))
        setFrames(prev => [...prev, ...newFrames])
      }
    }
  }

  const handleRemoveFrame = (index: number) => {
    setFrames(prev => prev.filter((_, i) => i !== index))
  }

  const handleMoveFrame = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newFrames = [...frames]
      ;[newFrames[index - 1], newFrames[index]] = [newFrames[index], newFrames[index - 1]]
      setFrames(newFrames)
    } else if (direction === 'down' && index < frames.length - 1) {
      const newFrames = [...frames]
      ;[newFrames[index], newFrames[index + 1]] = [newFrames[index + 1], newFrames[index]]
      setFrames(newFrames)
    }
  }

  const handleDelayChange = (index: number, newDelay: number | null) => {
    const newFrames = [...frames]
    newFrames[index].delay = newDelay || delay
    setFrames(newFrames)
  }

  const handleSelectOutputPath = async () => {
    if (window.electronAPI?.openDirectory) {
      const dir = await window.electronAPI.openDirectory()
      if (dir) {
        setSharedOutputPath(dir)
      }
    }
  }

  const handleApplyDelayToAll = () => {
    const newFrames = frames.map(f => ({ ...f, delay }))
    setFrames(newFrames)
  }

  const handleExecute = async () => {
    if (frames.length < 2) {
      message.warning('请至少选择2张图片')
      return
    }

    if (!outputPath) {
      message.warning('请选择输出目录')
      return
    }

    setIsProcessing(true)

    try {
      const gifFrames: GifFrame[] = frames.map(f => ({
        imagePath: f.path,
        delay: f.delay
      }))

      const options: GifOptions = {
        width,
        height,
        delay,
        loop,
        quality,
        outputPath
      }

      const result = await window.electronAPI.createGif(gifFrames, options)

      if (result) {
        message.success('GIF创建成功！')
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
      title="GIF制作"
      width={900}
      styles={{ body: { padding: '16px', overflow: 'hidden' } }}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button 
            type="primary" 
            onClick={handleExecute}
            disabled={frames.length < 2 || !outputPath || isProcessing}
            loading={isProcessing}
          >
            {isProcessing ? '处理中...' : '创建GIF'}
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 16, height: '60vh' }}>
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <Card size="small" title="选择图片">
            <Button 
              icon={<FolderOpenOutlined />} 
              onClick={handleSelectFrames}
              block
              style={{ marginBottom: 8 }}
            >
              添加帧
            </Button>
            <Text type="secondary">已选择: {frames.length} 帧</Text>
          </Card>

          <Card size="small" title="尺寸设置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Text>宽度</Text>
                  <InputNumber 
                    value={width} 
                    onChange={v => setWidth(v || undefined)} 
                    min={10} 
                    max={2000}
                    placeholder="自动"
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Text>高度</Text>
                  <InputNumber 
                    value={height} 
                    onChange={v => setHeight(v || undefined)} 
                    min={10} 
                    max={2000}
                    placeholder="自动"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </Space>
          </Card>

          <Card size="small" title="动画设置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text>帧延迟: {delay}ms</Text>
                <Slider 
                  value={delay} 
                  onChange={setDelay}
                  min={50}
                  max={2000}
                  step={50}
                />
              </div>
              <Button size="small" onClick={handleApplyDelayToAll}>
                应用到所有帧
              </Button>
              <div>
                <Text>循环次数</Text>
                <Select 
                  value={loop} 
                  onChange={setLoop}
                  style={{ width: '100%' }}
                >
                  <Select.Option value={0}>无限循环</Select.Option>
                  <Select.Option value={1}>播放1次</Select.Option>
                  <Select.Option value={2}>播放2次</Select.Option>
                  <Select.Option value={3}>播放3次</Select.Option>
                </Select>
              </div>
              <div>
                <Text>质量: {quality}</Text>
                <Slider 
                  value={quality} 
                  onChange={setQuality}
                  min={1}
                  max={20}
                />
              </div>
            </Space>
          </Card>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong>帧列表 ({frames.length} 帧)</Text>
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
            {frames.length === 0 ? (
              <Empty description="请先添加图片作为帧" />
            ) : (
              <div style={{ padding: 8 }}>
                {frames.map((frame, index) => (
                  <Card
                    size="small"
                    key={index}
                    style={{ marginBottom: 8 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text ellipsis style={{ flex: 1, marginRight: 8, maxWidth: 200 }}>
                        {index + 1}. {frame.name}
                      </Text>
                      <Space size="small">
                        <InputNumber 
                          size="small"
                          value={frame.delay}
                          onChange={v => handleDelayChange(index, v)}
                          min={50}
                          max={5000}
                          step={50}
                          style={{ width: 80 }}
                          addonAfter="ms"
                        />
                        <Button 
                          size="small" 
                          icon={<ArrowUpOutlined />}
                          onClick={() => handleMoveFrame(index, 'up')}
                          disabled={index === 0}
                        />
                        <Button 
                          size="small" 
                          icon={<ArrowDownOutlined />}
                          onClick={() => handleMoveFrame(index, 'down')}
                          disabled={index === frames.length - 1}
                        />
                        <Button 
                          size="small" 
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveFrame(index)}
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

export default GifMaker
