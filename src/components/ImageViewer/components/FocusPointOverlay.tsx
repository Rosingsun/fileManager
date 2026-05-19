import React from 'react'
import type { PhotoFocusPoint } from '../../../types'
import './FocusPointOverlay.css'

export interface FocusPointOverlayProps {
  points: PhotoFocusPoint[]
  activeIndex: number
  visible: boolean
}

const FocusPointOverlay: React.FC<FocusPointOverlayProps> = ({ points, activeIndex, visible }) => {
  if (!visible || points.length === 0) return null

  return (
    <div className="image-viewer-focus-overlay" aria-hidden>
      {points.map((point, index) => (
        <div
          key={index}
          className={`image-viewer-focus-marker${
            index === activeIndex ? ' image-viewer-focus-marker--active' : ''
          }`}
          style={{
            left: `${Math.min(100, Math.max(0, point.x * 100))}%`,
            top: `${Math.min(100, Math.max(0, point.y * 100))}%`,
          }}
        />
      ))}
    </div>
  )
}

export default FocusPointOverlay
