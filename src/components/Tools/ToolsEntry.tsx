import React, { useState } from 'react'
import { ToolOutlined } from '@ant-design/icons'
import {
  EditOutlined,
  ScissorOutlined,
  ColumnWidthOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  PictureOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import BatchRename from './BatchRename/BatchRename'
import Watermark from './Watermark/Watermark'
import ImageStitch from './ImageStitch/ImageStitch'
import GifMaker from './GifMaker/GifMaker'
import ImageFormatConverter from './ImageFormatConverter/ImageFormatConverter'
import ThumbnailGen from './ThumbnailGen/ThumbnailGen'
import ImageEnhance from './ImageEnhance/ImageEnhance'
import './tools.css'

const tools = [
  { key: 'batchRename', name: '批量重命名', description: '序号、日期、替换等多种规则', icon: <EditOutlined />, accent: '#0a84ff' },
  { key: 'watermark', name: '添加水印', description: '文字或图片水印，支持批量', icon: <PictureOutlined />, accent: '#30b95a' },
  { key: 'stitch', name: '图片拼接', description: '横向或纵向拼接为一张', icon: <ColumnWidthOutlined />, accent: '#ff9f0a' },
  { key: 'gif', name: 'GIF制作', description: '多图合成为 GIF 动画', icon: <FileImageOutlined />, accent: '#ff453a' },
  { key: 'formatConversion', name: '图片类型转换', description: 'JPEG/PNG/WebP/BMP/TIFF/PDF', icon: <FilePdfOutlined />, accent: '#7c5cff' },
  { key: 'thumbnail', name: '缩略图生成', description: '批量生成指定尺寸缩略图', icon: <ScissorOutlined />, accent: '#5ac8fa' },
  { key: 'enhance', name: '图片增强', description: '一键优化清晰度与曝光', icon: <ThunderboltOutlined />, accent: '#ff6b9d' },
] as const

const ToolsEntry: React.FC = () => {
  const [activeTool, setActiveTool] = useState<string | null>(null)

  const renderToolModal = () => {
    const onClose = () => setActiveTool(null)
    switch (activeTool) {
      case 'batchRename':
        return <BatchRename visible onClose={onClose} />
      case 'watermark':
        return <Watermark visible onClose={onClose} />
      case 'stitch':
        return <ImageStitch visible onClose={onClose} />
      case 'gif':
        return <GifMaker visible onClose={onClose} />
      case 'formatConversion':
        return <ImageFormatConverter visible onClose={onClose} />
      case 'thumbnail':
        return <ThumbnailGen visible onClose={onClose} />
      case 'enhance':
        return <ImageEnhance visible onClose={onClose} />
      default:
        return null
    }
  }

  return (
    <>
      <div className="app-tab-panel tools-entry-page">
        <header className="tools-entry-hero">
          <div className="tools-entry-hero__brand">
            <span className="tools-entry-hero__icon" aria-hidden>
              <ToolOutlined />
            </span>
            <div>
              <h1 className="tools-entry-hero__title">实用工具</h1>
              <p className="tools-entry-hero__subtitle">批量处理图片：重命名、水印、拼接、格式转换等</p>
            </div>
          </div>
        </header>

        <div className="tools-entry-grid" role="list">
          {tools.map((tool) => (
            <button
              key={tool.key}
              type="button"
              role="listitem"
              className="tools-entry-card"
              style={{ ['--tool-accent' as string]: tool.accent }}
              onClick={() => setActiveTool(tool.key)}
            >
              <span className="tools-entry-card__icon" aria-hidden>
                {tool.icon}
              </span>
              <span className="tools-entry-card__label">{tool.name}</span>
              <span className="tools-entry-card__desc">{tool.description}</span>
            </button>
          ))}
        </div>
      </div>
      {renderToolModal()}
    </>
  )
}

export default ToolsEntry
