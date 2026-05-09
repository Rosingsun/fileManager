import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { ImageEditSettings } from '../../types'

interface CropOverlayProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
  imageWidth: number
  imageHeight: number
}

const MIN_CROP = 20

function getOverlayImage(overlayRoot: HTMLDivElement | null): HTMLImageElement | null {
  if (!overlayRoot?.parentElement) return null
  return overlayRoot.parentElement.querySelector('img')
}

function getImagePoint(
  overlayRoot: HTMLDivElement,
  imageWidth: number,
  imageHeight: number,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const img = getOverlayImage(overlayRoot)
  if (!img || imageWidth <= 0 || imageHeight <= 0) return { x: 0, y: 0 }
  const rect = img.getBoundingClientRect()
  const sx = rect.width > 0 ? imageWidth / rect.width : 1
  const sy = rect.height > 0 ? imageHeight / rect.height : 1
  const x = Math.max(0, Math.min(imageWidth, (clientX - rect.left) * sx))
  const y = Math.max(0, Math.min(imageHeight, (clientY - rect.top) * sy))
  return { x, y }
}

const CropOverlay: React.FC<CropOverlayProps> = ({ settings, onChange, imageWidth, imageHeight }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [dragType, setDragType] = useState<'move' | 'resize' | 'marquee' | null>(null)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const startCrop = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const marqueeStart = useRef({ x: 0, y: 0 })

  const getCropRect = () => {
    if (!settings.crop || settings.crop.width === 0 || settings.crop.height === 0) {
      return { x: 0, y: 0, width: imageWidth, height: imageHeight }
    }
    return settings.crop
  }

  useEffect(() => {
    const updateDisplaySize = () => {
      const img = getOverlayImage(containerRef.current)
      if (img) {
        setDisplaySize({ width: img.offsetWidth, height: img.offsetHeight })
      }
    }
    updateDisplaySize()
    const imgEl = getOverlayImage(containerRef.current)
    imgEl?.addEventListener('load', updateDisplaySize)
    const observer = new MutationObserver(updateDisplaySize)
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true })
    }
    window.addEventListener('resize', updateDisplaySize)
    return () => {
      imgEl?.removeEventListener('load', updateDisplaySize)
      observer.disconnect()
      window.removeEventListener('resize', updateDisplaySize)
    }
  }, [imageWidth, imageHeight])

  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'resize', handle?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setDragType(type)
    setResizeHandle(handle || null)
    startPos.current = { x: e.clientX, y: e.clientY }
    startCrop.current = getCropRect()
  }

  const handleShadeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const container = containerRef.current
    if (!container) return
    const p = getImagePoint(container, imageWidth, imageHeight, e.clientX, e.clientY)
    marqueeStart.current = p
    setIsDragging(true)
    setDragType('marquee')
    setResizeHandle(null)
    startPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragType) return

    const container = containerRef.current
    if (!container) return

    const img = getOverlayImage(container)
    if (!img) return

    const rect = img.getBoundingClientRect()
      const sx = rect.width > 0 ? imageWidth / rect.width : 1
      const sy = rect.height > 0 ? imageHeight / rect.height : 1
      const dx = (e.clientX - startPos.current.x) * sx
      const dy = (e.clientY - startPos.current.y) * sy
      const crop = { ...startCrop.current }

      if (dragType === 'marquee') {
        const end = getImagePoint(container, imageWidth, imageHeight, e.clientX, e.clientY)
        const start = marqueeStart.current
        let x = Math.min(start.x, end.x)
        let y = Math.min(start.y, end.y)
        let w = Math.abs(end.x - start.x)
        let h = Math.abs(end.y - start.y)
        w = Math.max(MIN_CROP, w)
        h = Math.max(MIN_CROP, h)
        if (x + w > imageWidth) x = Math.max(0, imageWidth - w)
        if (y + h > imageHeight) y = Math.max(0, imageHeight - h)
        x = Math.max(0, Math.min(x, imageWidth - MIN_CROP))
        y = Math.max(0, Math.min(y, imageHeight - MIN_CROP))
        w = Math.min(w, imageWidth - x)
        h = Math.min(h, imageHeight - y)
        w = Math.max(MIN_CROP, w)
        h = Math.max(MIN_CROP, h)
        onChange({
          crop: {
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(w),
            height: Math.round(h),
          },
        })
        return
      }

      if (dragType === 'move') {
        let newX = crop.x + dx
        let newY = crop.y + dy
        newX = Math.max(0, Math.min(newX, imageWidth - crop.width))
        newY = Math.max(0, Math.min(newY, imageHeight - crop.height))
        onChange({ crop: { ...crop, x: Math.round(newX), y: Math.round(newY) } })
      } else if (dragType === 'resize' && resizeHandle) {
        let newX = crop.x
        let newY = crop.y
        let newWidth = crop.width
        let newHeight = crop.height

        if (resizeHandle.includes('e')) {
          newWidth = Math.max(MIN_CROP, Math.min(crop.width + dx, imageWidth - crop.x))
        }
        if (resizeHandle.includes('w')) {
          const maxDx = crop.width - MIN_CROP
          const actualDx = Math.max(-crop.x, Math.min(dx, maxDx))
          newX = crop.x + actualDx
          newWidth = crop.width - actualDx
        }
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(MIN_CROP, Math.min(crop.height + dy, imageHeight - crop.y))
        }
        if (resizeHandle.includes('n')) {
          const maxDy = crop.height - MIN_CROP
          const actualDy = Math.max(-crop.y, Math.min(dy, maxDy))
          newY = crop.y + actualDy
          newHeight = crop.height - actualDy
        }

        newX = Math.max(0, Math.min(newX, imageWidth - newWidth))
        newY = Math.max(0, Math.min(newY, imageHeight - newHeight))
        newWidth = Math.min(newWidth, imageWidth - newX)
        newHeight = Math.min(newHeight, imageHeight - newY)

        onChange({
          crop: {
            x: Math.round(newX),
            y: Math.round(newY),
            width: Math.round(newWidth),
            height: Math.round(newHeight),
          },
        })
      }
    },
    [isDragging, dragType, resizeHandle, imageWidth, imageHeight, onChange]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragType(null)
    setResizeHandle(null)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const crop = getCropRect()
  const scale = displaySize.width > 0 && imageWidth > 0 ? displaySize.width / imageWidth : 1
  const scaleY = displaySize.height > 0 && imageHeight > 0 ? displaySize.height / imageHeight : scale

  const displayCrop = {
    x: crop.x * scale,
    y: crop.y * scaleY,
    width: crop.width * scale,
    height: crop.height * scaleY,
  }

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: '#007AFF',
    border: '2px solid white',
    borderRadius: 2,
    cursor: 'pointer',
    zIndex: 10,
  }

  const shade = 'rgba(0, 0, 0, 0.5)'
  const dw = displaySize.width
  const dh = displaySize.height
  const { x: cx, y: cy, width: cw, height: ch } = displayCrop

  if (displaySize.width === 0 || displaySize.height === 0) {
    return <div ref={containerRef} style={{ position: 'absolute', top: 0, left: 0 }} />
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: dw,
        height: dh,
        cursor: isDragging ? (dragType === 'marquee' ? 'crosshair' : 'grabbing') : 'default',
        userSelect: 'none',
      }}
    >
      {/* 暗区可接收鼠标：框选新裁切范围 */}
      {cy > 0 && (
        <div
          style={{ position: 'absolute', left: 0, top: 0, width: dw, height: cy, background: shade, zIndex: 1 }}
          onMouseDown={handleShadeMouseDown}
        />
      )}
      {cx > 0 && ch > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: cy,
            width: cx,
            height: ch,
            background: shade,
            zIndex: 1,
          }}
          onMouseDown={handleShadeMouseDown}
        />
      )}
      {cx + cw < dw && ch > 0 && (
        <div
          style={{
            position: 'absolute',
            left: cx + cw,
            top: cy,
            width: dw - cx - cw,
            height: ch,
            background: shade,
            zIndex: 1,
          }}
          onMouseDown={handleShadeMouseDown}
        />
      )}
      {cy + ch < dh && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: cy + ch,
            width: dw,
            height: dh - cy - ch,
            background: shade,
            zIndex: 1,
          }}
          onMouseDown={handleShadeMouseDown}
        />
      )}

      <div
        style={{
          position: 'absolute',
          left: displayCrop.x,
          top: displayCrop.y,
          width: displayCrop.width,
          height: displayCrop.height,
          backgroundColor: 'transparent',
          cursor: 'move',
          zIndex: 2,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      />
      <div
        style={{
          position: 'absolute',
          left: displayCrop.x - 1,
          top: displayCrop.y - 1,
          width: displayCrop.width + 2,
          height: displayCrop.height + 2,
          border: '2px dashed #007AFF',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />
      <div style={{ ...handleStyle, top: displayCrop.y - 6, left: displayCrop.x - 6 }} onMouseDown={(e) => handleMouseDown(e, 'resize', 'nw')} />
      <div style={{ ...handleStyle, top: displayCrop.y - 6, left: displayCrop.x + displayCrop.width / 2 - 6 }} onMouseDown={(e) => handleMouseDown(e, 'resize', 'n')} />
      <div style={{ ...handleStyle, top: displayCrop.y - 6, left: displayCrop.x + displayCrop.width - 6 }} onMouseDown={(e) => handleMouseDown(e, 'resize', 'ne')} />
      <div style={{ ...handleStyle, top: displayCrop.y + displayCrop.height / 2 - 6, left: displayCrop.x - 6 }} onMouseDown={(e) => handleMouseDown(e, 'resize', 'w')} />
      <div style={{ ...handleStyle, top: displayCrop.y + displayCrop.height / 2 - 6, left: displayCrop.x + displayCrop.width - 6 }} onMouseDown={(e) => handleMouseDown(e, 'resize', 'e')} />
      <div style={{ ...handleStyle, top: displayCrop.y + displayCrop.height - 6, left: displayCrop.x - 6 }} onMouseDown={(e) => handleMouseDown(e, 'resize', 'sw')} />
      <div style={{ ...handleStyle, top: displayCrop.y + displayCrop.height - 6, left: displayCrop.x + displayCrop.width / 2 - 6 }} onMouseDown={(e) => handleMouseDown(e, 'resize', 's')} />
      <div style={{ ...handleStyle, top: displayCrop.y + displayCrop.height - 6, left: displayCrop.x + displayCrop.width - 6 }} onMouseDown={(e) => handleMouseDown(e, 'resize', 'se')} />
    </div>
  )
}

export default CropOverlay
