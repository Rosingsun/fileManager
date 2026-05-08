/**
 * 文件信息区域组件
 */

import React from 'react'
import type { Image } from '../types'
import { formatFileSize, formatDateTime } from '../../../utils'
import './InfoPanel.css'

export interface FileInfoSectionProps {
  image: Image
}

function formatImageMetaTime(iso: string): string {
  if (!iso?.trim()) return '—'
  const t = Date.parse(iso)
  return Number.isNaN(t) ? '—' : formatDateTime(t)
}

const FileInfoSection: React.FC<FileInfoSectionProps> = ({ image }) => {
  const hasDimensions = image.width > 0 && image.height > 0
  const sizeLabel = image.size > 0 ? formatFileSize(image.size) : '—'

  return (
    <div className="info-section">
      <h3 className="info-section-title">文件信息</h3>
      <div className="info-section-content">
        <div className="info-item">
          <span className="info-label">文件名：</span>
          <span className="info-value">{image.filename}</span>
        </div>
        <div className="info-item">
          <span className="info-label">尺寸：</span>
          <span className="info-value">
            {hasDimensions ? `${image.width} × ${image.height} 像素` : '—'}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">大小：</span>
          <span className="info-value">{sizeLabel}</span>
        </div>
        <div className="info-item">
          <span className="info-label">格式：</span>
          <span className="info-value">{image.format.toUpperCase()}</span>
        </div>
        <div className="info-item">
          <span className="info-label">创建时间：</span>
          <span className="info-value">{formatImageMetaTime(image.createdAt)}</span>
        </div>
        <div className="info-item">
          <span className="info-label">修改时间：</span>
          <span className="info-value">{formatImageMetaTime(image.modifiedAt)}</span>
        </div>
      </div>
    </div>
  )
}

export default FileInfoSection

