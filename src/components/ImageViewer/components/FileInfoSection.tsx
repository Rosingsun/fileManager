/**
 * 文件信息区域组件
 */

import React from 'react'
import type { Image } from '../types'
import { formatFileSize, formatDateTime } from '../utils/imageUtils'
import './InfoPanel.css'

export interface FileInfoSectionProps {
  image: Image
}

const FileInfoSection: React.FC<FileInfoSectionProps> = ({ image }) => {
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
          <span className="info-value">{image.width} × {image.height} 像素</span>
        </div>
        <div className="info-item">
          <span className="info-label">大小：</span>
          <span className="info-value">{formatFileSize(image.size)}</span>
        </div>
        <div className="info-item">
          <span className="info-label">格式：</span>
          <span className="info-value">{image.format.toUpperCase()}</span>
        </div>
        <div className="info-item">
          <span className="info-label">创建时间：</span>
          <span className="info-value">{formatDateTime(image.createdAt)}</span>
        </div>
        <div className="info-item">
          <span className="info-label">修改时间：</span>
          <span className="info-value">{formatDateTime(image.modifiedAt)}</span>
        </div>
      </div>
    </div>
  )
}

export default FileInfoSection

