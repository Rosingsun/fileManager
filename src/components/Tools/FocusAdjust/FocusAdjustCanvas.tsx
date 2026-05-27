import React, { useRef } from 'react'
import '../../ImageViewer/components/FocusPointOverlay.css'
import './focus-adjust.css'

export interface FocusAdjustCanvasProps {
  imageSrc: string | null
  focusX: number
  focusY: number
  radiusPercent: number
  hasFocusPoint: boolean
  onFocusChange: (x: number, y: number) => void
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const FocusAdjustCanvas: React.FC<FocusAdjustCanvasProps> = ({
  imageSrc,
  focusX,
  focusY,
  radiusPercent,
  hasFocusPoint,
  onFocusChange
}) => {
  const wrapRef = useRef<HTMLDivElement>(null)

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current
    if (!el || !imageSrc) return
    const rect = el.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    const x = clamp01((e.clientX - rect.left) / rect.width)
    const y = clamp01((e.clientY - rect.top) / rect.height)
    onFocusChange(x, y)
  }

  return (
    <div
      ref={wrapRef}
      className="focus-adjust-canvas"
      onClick={handleClick}
      role="presentation"
    >
      {imageSrc ? (
        <img src={imageSrc} alt="对焦预览" className="focus-adjust-canvas__img" draggable={false} />
      ) : (
        <div className="focus-adjust-canvas__placeholder">选择图片后，点击画面设定对焦点</div>
      )}
      {hasFocusPoint && imageSrc ? (
        <>
          <div
            className="focus-adjust-canvas__region"
            style={{
              left: `${focusX * 100}%`,
              top: `${focusY * 100}%`,
              width: `${radiusPercent * 2}%`,
              height: `${radiusPercent * 2}%`
            }}
          />
          <div
            className="focus-adjust-canvas__marker image-viewer-focus-marker image-viewer-focus-marker--active"
            style={{
              left: `${focusX * 100}%`,
              top: `${focusY * 100}%`
            }}
          />
        </>
      ) : null}
    </div>
  )
}

export default FocusAdjustCanvas
