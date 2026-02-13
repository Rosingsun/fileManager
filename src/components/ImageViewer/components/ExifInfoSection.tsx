/**
 * EXIF信息区域组件
 */

import React, { useState } from 'react'
import { useExifParser } from '../../../hooks'
import type { Image } from '../types'
import './InfoPanel.css'

export interface ExifInfoSectionProps {
  image: Image
}

const ExifInfoSection: React.FC<ExifInfoSectionProps> = ({ image }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const { formattedExif, isLoading } = useExifParser(image.exif, image.url)

  // 切换展开/折叠状态
  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  // 如果没有EXIF数据，显示简化版本
  if (Object.keys(formattedExif).length === 0) {
    return (
      <div className="info-section">
        <div className="info-section-header">
          <h3 className="info-section-title">EXIF信息</h3>
        </div>
        <div className="info-section-content">
          {isLoading ? (
            <div className="info-loading">加载中...</div>
          ) : (
            <div className="info-empty">暂无EXIF数据</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="info-section exif-section">
      <div className="info-section-header">
        <h3 className="info-section-title">EXIF信息</h3>
        <button 
          className="section-toggle-btn" 
          onClick={toggleExpand}
          title={isExpanded ? "收起EXIF信息" : "查看EXIF信息"}
        >
          {isExpanded ? "▼" : "▶"}
        </button>
      </div>
      
      {isExpanded && (
        <div className="info-section-content">
          {isLoading ? (
            <div className="info-loading">加载中...</div>
          ) : (
            <div className="exif-info-grid">
              {Object.entries(formattedExif).map(([key, value]) => (
                <div key={key} className="exif-info-item">
                  <div className="exif-info-label">{key}</div>
                  <div className="exif-info-value">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ExifInfoSection

