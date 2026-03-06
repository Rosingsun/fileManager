import React, { useState } from 'react'
import { Card, Row, Col, Typography, Space } from 'antd'
import {
  EditOutlined,
  ScissorOutlined,
  ColumnWidthOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  PictureOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'

import BatchRename from './BatchRename/BatchRename'
import Watermark from './Watermark/Watermark'
import ImageStitch from './ImageStitch/ImageStitch'
import GifMaker from './GifMaker/GifMaker'
import ImageToPdf from './ImageToPdf/ImageToPdf'
import ThumbnailGen from './ThumbnailGen/ThumbnailGen'
import ImageEnhance from './ImageEnhance/ImageEnhance'

const { Title, Text } = Typography

interface ToolItem {
  key: string
  name: string
  description: string
  icon: React.ReactNode
}

const tools: ToolItem[] = [
  {
    key: 'batchRename',
    name: '批量重命名',
    description: '批量修改文件名，支持序号、日期、替换等多种规则',
    icon: <EditOutlined style={{ fontSize: 32, color: '#1890ff' }} />
  },
  {
    key: 'watermark',
    name: '添加水印',
    description: '为图片添加文字或图片水印，支持批量处理',
    icon: <PictureOutlined style={{ fontSize: 32, color: '#52c41a' }} />
  },
  {
    key: 'stitch',
    name: '图片拼接',
    description: '将多张图片横向或纵向拼接为一张',
    icon: <ColumnWidthOutlined style={{ fontSize: 32, color: '#faad14' }} />
  },
  {
    key: 'gif',
    name: 'GIF制作',
    description: '将多张图片合成为 GIF 动画',
    icon: <FileImageOutlined style={{ fontSize: 32, color: '#f5222d' }} />
  },
  {
    key: 'toPdf',
    name: '图片转PDF',
    description: '将单张或多张图片转换为 PDF 文档',
    icon: <FilePdfOutlined style={{ fontSize: 32, color: '#722ed1' }} />
  },
  {
    key: 'thumbnail',
    name: '缩略图生成',
    description: '为图片批量生成指定尺寸的缩略图',
    icon: <ScissorOutlined style={{ fontSize: 32, color: '#13c2c2' }} />
  },
  {
    key: 'enhance',
    name: '图片增强',
    description: '一键优化图片质量，提升清晰度',
    icon: <ThunderboltOutlined style={{ fontSize: 32, color: '#eb2f96' }} />
  }
]

const ToolsEntry: React.FC = () => {
  const [activeTool, setActiveTool] = useState<string | null>(null)

  const renderToolModal = () => {
    switch (activeTool) {
      case 'batchRename':
        return <BatchRename visible={true} onClose={() => setActiveTool(null)} />
      case 'watermark':
        return <Watermark visible={true} onClose={() => setActiveTool(null)} />
      case 'stitch':
        return <ImageStitch visible={true} onClose={() => setActiveTool(null)} />
      case 'gif':
        return <GifMaker visible={true} onClose={() => setActiveTool(null)} />
      case 'toPdf':
        return <ImageToPdf visible={true} onClose={() => setActiveTool(null)} />
      case 'thumbnail':
        return <ThumbnailGen visible={true} onClose={() => setActiveTool(null)} />
      case 'enhance':
        return <ImageEnhance visible={true} onClose={() => setActiveTool(null)} />
      default:
        return null
    }
  }

  return (
    <>
      <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
        <Title level={3} style={{ marginBottom: 24 }}>实用工具</Title>
        <Row gutter={[16, 16]}>
          {tools.map((tool) => (
            <Col xs={24} sm={12} md={8} lg={6} key={tool.key}>
              <Card
                hoverable
                onClick={() => setActiveTool(tool.key)}
                style={{ height: '100%' }}
                styles={{ body: { padding: 20, textAlign: 'center' } }}
              >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div style={{ padding: '10px 0' }}>
                    {tool.icon}
                  </div>
                  <Title level={5} style={{ margin: 0 }}>{tool.name}</Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {tool.description}
                  </Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
      {renderToolModal()}
    </>
  )
}

export default ToolsEntry
