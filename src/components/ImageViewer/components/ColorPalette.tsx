/**
 * 主要颜色提取组件
 */

import React, { useState } from 'react'
import { useColorExtractor } from '../../../hooks'
import { copyToClipboard } from '../../../utils'
import './InfoPanel.css'

export interface ColorPaletteProps {
  imageUrl: string | null
  backgroundColor: string | null
  onBackgroundColorChange: (color: string | null) => void
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ 
  imageUrl,
  backgroundColor,
  onBackgroundColorChange 
}) => {
  const { colors, isLoading } = useColorExtractor(imageUrl, 8)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleColorClick = async (hex: string, index: number) => {
    const success = await copyToClipboard(hex)
    if (success) {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
  }

  const handleSetBackground = async (hex: string, index: number) => {
    const success = await copyToClipboard(hex)
    if (success) {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
    onBackgroundColorChange(hex)
  }

  const handleRemoveBackground = (e: React.MouseEvent) => {
    e.stopPropagation()
    onBackgroundColorChange(null)
  }

  const isSelected = (hex: string) => {
    if (!backgroundColor) return false
    return backgroundColor.toLowerCase() === hex.toLowerCase()
  }

  if (isLoading) {
    return (
      <div className="info-section">
        <h3 className="info-section-title">主要颜色</h3>
        <div className="info-section-content">
          <div className="info-empty">正在提取颜色...</div>
        </div>
      </div>
    )
  }

  if (colors.length === 0) {
    return (
      <div className="info-section">
        <h3 className="info-section-title">主要颜色</h3>
        <div className="info-section-content">
          <div className="info-empty">无法提取颜色</div>
        </div>
      </div>
    )
  }

  return (
    <div className="info-section">
      <h3 className="info-section-title">主要颜色</h3>
      <div className="info-section-content">
        <div className="color-palette">
          {colors.map((color, index) => (
            <div
              key={index}
              className={`color-item ${isSelected(color.hex) ? 'color-item-selected' : ''}`}
              onClick={() => handleSetBackground(color.hex, index)}
              title={`点击复制颜色并设为背景色`}
            >
              <div className="color-swatch-wrapper">
                <div
                  className="color-swatch"
                  style={{ backgroundColor: color.hex }}
                />
                {isSelected(color.hex) && (
                  <button
                    className="color-remove-btn"
                    onClick={handleRemoveBackground}
                    title="移除背景色"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="color-info">
                <div 
                  className="color-hex"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleColorClick(color.hex, index)
                  }}
                >
                  {color.hex}
                </div>
                {copiedIndex === index && (
                  <div className="color-copied">已复制</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ColorPalette

