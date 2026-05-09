/**
 * 主要颜色提取组件
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Segmented } from 'antd'
import { useColorExtractor } from '../../../hooks'
import type { ColorInfo } from '../types'
import {
  copyToClipboard,
  formatHslCss,
  formatRgbComma,
  formatRgbCss,
  normalizeHex
} from '../../../utils'
import './InfoPanel.css'

export type ColorDisplayFormat = 'hex' | 'rgb' | 'hsl'

function getDisplayValue(color: ColorInfo, mode: ColorDisplayFormat): string {
  const { r, g, b } = color.rgb
  switch (mode) {
    case 'hex':
      return normalizeHex(color.hex)
    case 'rgb':
      return formatRgbCss(r, g, b)
    case 'hsl':
      return formatHslCss(r, g, b)
    default:
      return normalizeHex(color.hex)
  }
}

export interface ColorPaletteProps {
  imageUrl: string | null
  /** 图片源尚未就绪（如正在将 file:// 读成 data URL） */
  sourceLoading?: boolean
  backgroundColor: string | null
  onBackgroundColorChange: (color: string | null) => void
}

const ColorPalette: React.FC<ColorPaletteProps> = ({
  imageUrl,
  sourceLoading = false,
  backgroundColor,
  onBackgroundColorChange
}) => {
  const { colors, isLoading } = useColorExtractor(imageUrl, 8)
  const [displayFormat, setDisplayFormat] = useState<ColorDisplayFormat>('hex')
  const [activeColorIndex, setActiveColorIndex] = useState(0)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedFormatKey, setCopiedFormatKey] = useState<string | null>(null)

  useEffect(() => {
    if (colors.length === 0) return
    setActiveColorIndex((i) => (i < colors.length ? i : 0))
  }, [colors])

  const handleColorClick = async (color: ColorInfo, index: number) => {
    setActiveColorIndex(index)
    const text = getDisplayValue(color, displayFormat)
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
  }

  const handleSetBackground = async (color: ColorInfo, index: number) => {
    setActiveColorIndex(index)
    const text = getDisplayValue(color, displayFormat)
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    }
    onBackgroundColorChange(normalizeHex(color.hex))
  }

  const handleRemoveBackground = (e: React.MouseEvent) => {
    e.stopPropagation()
    onBackgroundColorChange(null)
  }

  const isSelected = (hex: string) => {
    if (!backgroundColor) return false
    return backgroundColor.toLowerCase() === hex.toLowerCase()
  }

  const copyFormatRow = useCallback(async (key: string, text: string) => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopiedFormatKey(key)
      setTimeout(() => setCopiedFormatKey(null), 2000)
    }
  }, [])

  if (sourceLoading) {
    return (
      <div className="info-section">
        <h3 className="info-section-title">主要颜色</h3>
        <div className="info-section-content">
          <div className="info-empty">正在加载图片...</div>
        </div>
      </div>
    )
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

  const active = colors[Math.min(activeColorIndex, colors.length - 1)]!
  const { r, g, b } = active.rgb
  const hexNorm = normalizeHex(active.hex)

  return (
    <div className="info-section">
      <div className="color-palette-section-heading">
        <h3 className="info-section-title">主要颜色</h3>
        <Segmented<ColorDisplayFormat>
          size="small"
          className="color-format-segmented"
          value={displayFormat}
          onChange={(v) => setDisplayFormat(v)}
          options={[
            { label: '十六进制', value: 'hex' },
            { label: 'RGB', value: 'rgb' },
            { label: 'HSL', value: 'hsl' }
          ]}
        />
      </div>
      <div className="info-section-content">
        <div className="color-palette">
          {colors.map((color, index) => (
            <div
              key={index}
              className={`color-item ${isSelected(color.hex) ? 'color-item-selected' : ''}`}
              onClick={() => handleSetBackground(color, index)}
              title="点击复制当前格式并设为背景色"
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
                    handleColorClick(color, index)
                  }}
                >
                  {getDisplayValue(color, displayFormat)}
                </div>
                {copiedIndex === index && (
                  <div className="color-copied">已复制</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="color-copy-panel">
          <div className="color-copy-panel-title">复制当前色块（多种格式）</div>
          <div className="color-copy-row">
            <span className="color-copy-label">十六进制</span>
            <code className="color-copy-value">{hexNorm}</code>
            <button
              type="button"
              className="color-copy-btn"
              onClick={() => copyFormatRow('hex', hexNorm)}
            >
              {copiedFormatKey === 'hex' ? '已复制' : '复制'}
            </button>
          </div>
          <div className="color-copy-row">
            <span className="color-copy-label">RGB</span>
            <code className="color-copy-value">{formatRgbCss(r, g, b)}</code>
            <button
              type="button"
              className="color-copy-btn"
              onClick={() => copyFormatRow('rgb', formatRgbCss(r, g, b))}
            >
              {copiedFormatKey === 'rgb' ? '已复制' : '复制'}
            </button>
          </div>
          <div className="color-copy-row">
            <span className="color-copy-label">RGB 分量</span>
            <code className="color-copy-value">{formatRgbComma(r, g, b)}</code>
            <button
              type="button"
              className="color-copy-btn"
              onClick={() => copyFormatRow('comma', formatRgbComma(r, g, b))}
            >
              {copiedFormatKey === 'comma' ? '已复制' : '复制'}
            </button>
          </div>
          <div className="color-copy-row">
            <span className="color-copy-label">HSL</span>
            <code className="color-copy-value">{formatHslCss(r, g, b)}</code>
            <button
              type="button"
              className="color-copy-btn"
              onClick={() => copyFormatRow('hsl', formatHslCss(r, g, b))}
            >
              {copiedFormatKey === 'hsl' ? '已复制' : '复制'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ColorPalette

