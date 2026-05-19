import React from 'react'
import type { PhotoFocusPoint } from '../../../types'
import './FocusPointOverlay.css'

export interface FocusPointOverlayProps {
  points: PhotoFocusPoint[]
  activeIndex: number
  visible: boolean
  style?: React.CSSProperties
  onSelect?: (index: number) => void
}

const FocusPointOverlay: React.FC<FocusPointOverlayProps> = ({
  points,
  activeIndex,
  visible,
  style,
  onSelect
}) => {
  if (!visible || points.length === 0) return null

  return (
    <div
      className="image-viewer-focus-overlay"
      style={style}
      aria-hidden={!onSelect}
    >
      {points.map((point, index) => (
        <button
          key={index}
          type="button"
          className={`image-viewer-focus-marker${
            index === activeIndex ? ' image-viewer-focus-marker--active' : ''
          }`}
          style={{
            left: `${Math.min(100, Math.max(0, point.x * 100))}%`,
            top: `${Math.min(100, Math.max(0, point.y * 100))}%`
          }}
          onClick={e => {
            e.stopPropagation()
            onSelect?.(index)
          }}
          aria-label={`对焦点 ${index + 1}`}
          tabIndex={-1}
        />
      ))}
    </div>
  )
}

export default FocusPointOverlay
