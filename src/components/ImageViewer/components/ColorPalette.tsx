/**
 * 主要颜色提取组件
 */

import React, { useState } from 'react'
import { useColorExtractor } from '../hooks/useColorExtractor'
import { copyToClipboard } from '../utils/colorUtils'
import './InfoPanel.css'

export interface ColorPaletteProps {
  imageUrl: string | null
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ imageUrl }) => {
  const { colors, isLoading } = useColorExtractor(imageUrl, 8)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleColorClick = async (hex: string, index: number) => {
    const success = await copyToClipboard(hex)
    if (success) {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
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
              className="color-item"
              onClick={() => handleColorClick(color.hex, index)}
              title={`点击复制 ${color.hex}`}
            >
              <div
                className="color-swatch"
                style={{ backgroundColor: color.hex }}
              />
              <div className="color-info">
                <div className="color-hex">{color.hex}</div>
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

