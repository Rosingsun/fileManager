import React, { useState } from 'react'
import { Col, Row, Typography } from 'antd'
import {
  EditOutlined,
  ScissorOutlined,
  ColumnWidthOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  PictureOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { PageSection, ToolTile } from '../UnifiedUI'
import BatchRename from './BatchRename/BatchRename'
import Watermark from './Watermark/Watermark'
import ImageStitch from './ImageStitch/ImageStitch'
import GifMaker from './GifMaker/GifMaker'
import ImageFormatConverter from './ImageFormatConverter/ImageFormatConverter'
import ThumbnailGen from './ThumbnailGen/ThumbnailGen'
import ImageEnhance from './ImageEnhance/ImageEnhance'

const { Text } = Typography

const tools = [
  { key: 'batchRename', name: '批量重命名', description: '序号、日期、替换等多种规则', icon: <EditOutlined />, accent: '#0a84ff' },
  { key: 'watermark', name: '添加水印', description: '文字或图片水印，支持批量', icon: <PictureOutlined />, accent: '#30b95a' },
  { key: 'stitch', name: '图片拼接', description: '横向或纵向拼接为一张', icon: <ColumnWidthOutlined />, accent: '#ff9f0a' },
  { key: 'gif', name: 'GIF制作', description: '多图合成为 GIF 动画', icon: <FileImageOutlined />, accent: '#ff453a' },
  { key: 'formatConversion', name: '图片类型转换', description: 'JPEG/PNG/WebP/BMP/TIFF/PDF', icon: <FilePdfOutlined />, accent: '#7c5cff' },
  { key: 'thumbnail', name: '缩略图生成', description: '批量生成指定尺寸缩略图', icon: <ScissorOutlined />, accent: '#5ac8fa' },
  { key: 'enhance', name: '图片增强', description: '一键优化清晰度', icon: <ThunderboltOutlined />, accent: '#ff6b9d' },
] as const

const ToolsEntry: React.FC = () => {
  const [activeTool, setActiveTool] = useState<string | null>(null)

  const renderToolModal = () => {
    switch (activeTool) {
      case 'batchRename':
        return <BatchRename visible onClose={() => setActiveTool(null)} />
      case 'watermark':
        return <Watermark visible onClose={() => setActiveTool(null)} />
      case 'stitch':
        return <ImageStitch visible onClose={() => setActiveTool(null)} />
      case 'gif':
        return <GifMaker visible onClose={() => setActiveTool(null)} />
      case 'formatConversion':
        return <ImageFormatConverter visible onClose={() => setActiveTool(null)} />
      case 'thumbnail':
        return <ThumbnailGen visible onClose={() => setActiveTool(null)} />
      case 'enhance':
        return <ImageEnhance visible onClose={() => setActiveTool(null)} />
      default:
        return null
    }
  }

  if (activeTool) {
    return renderToolModal()
  }

  return (
    <div className="app-tab-panel tools-entry-page">
      <PageSection title="实用工具" subtitle="选择工具后在弹窗中完成批量处理">
        <Row gutter={[12, 12]}>
          {tools.map((tool) => (
            <Col xs={24} sm={12} md={8} lg={6} key={tool.key}>
              <ToolTile
                label={tool.name}
                icon={tool.icon}
                accent={tool.accent}
                onClick={() => setActiveTool(tool.key)}
              />
              <Text type="secondary" className="tools-entry-tile-desc">
                {tool.description}
              </Text>
            </Col>
          ))}
        </Row>
      </PageSection>
    </div>
  )
}

export default ToolsEntry
