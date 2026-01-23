/**
 * EXIF信息区域组件
 */

import React from 'react'
import { useExifParser } from '../hooks/useExifParser'
import type { Image } from '../types'
import './InfoPanel.css'

export interface ExifInfoSectionProps {
  image: Image
}

const ExifInfoSection: React.FC<ExifInfoSectionProps> = ({ image }) => {
  const formattedExif = useExifParser(image.exif)

  if (Object.keys(formattedExif).length === 0) {
    return (
      <div className="info-section">
        <h3 className="info-section-title">EXIF信息</h3>
        <div className="info-section-content">
          <div className="info-empty">暂无EXIF数据</div>
        </div>
      </div>
    )
  }

  return (
    <div className="info-section">
      <h3 className="info-section-title">EXIF信息</h3>
      <div className="info-section-content">
        {Object.entries(formattedExif).map(([key, value]) => (
          <div key={key} className="info-item">
            <span className="info-label">{key}：</span>
            <span className="info-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ExifInfoSection

