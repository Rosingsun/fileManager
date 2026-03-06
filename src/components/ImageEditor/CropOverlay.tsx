import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { ImageEditSettings } from '../../types'

interface CropOverlayProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
  imageWidth: number
  imageHeight: number
}

const CropOverlay: React.FC<CropOverlayProps> = ({ settings, onChange, imageWidth, imageHeight }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [dragType, setDragType] = useState<'move' | 'resize' | null>(null)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const startCrop = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const getCropRect = () => {
    if (!settings.crop || settings.crop.width === 0 || settings.crop.height === 0) {
      return { x: 0, y: 0, width: imageWidth, height: imageHeight }
    }
    return settings.crop
  }

  useEffect(() => {
    const updateDisplaySize = () => {
      if (containerRef.current) {
        const img = containerRef.current.querySelector('img')
        if (img) {
          setDisplaySize({ width: img.offsetWidth, height: img.offsetHeight })
        }
      }
    }
    updateDisplaySize()
    const observer = new MutationObserver(updateDisplaySize)
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true })
    }
    window.addEventListener('resize', updateDisplaySize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateDisplaySize)
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent, type: 'move' | 'resize', handle?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setDragType(type)
    setResizeHandle(handle || null)
    startPos.current = { x: e.clientX, y: e.clientY }
    startCrop.current = getCropRect()
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragType) return

    const container = containerRef.current
    if (!container) return

    const img = container.querySelector('img') as HTMLImageElement
    if (!img) return

    const rect = img.getBoundingClientRect()
    const scale = imageWidth > 0 ? rect.width / imageWidth : 1

    const dx = (e.clientX - startPos.current.x) / scale
    const dy = (e.clientY - startPos.current.y) / scale
    const crop = { ...startCrop.current }

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
        newWidth = Math.max(20, Math.min(crop.width + dx, imageWidth - crop.x))
      }
      if (resizeHandle.includes('w')) {
        const maxDx = crop.width - 20
        const actualDx = Math.max(-crop.x, Math.min(dx, maxDx))
        newX = crop.x + actualDx
        newWidth = crop.width - actualDx
      }
      if (resizeHandle.includes('s')) {
        newHeight = Math.max(20, Math.min(crop.height + dy, imageHeight - crop.y))
      }
      if (resizeHandle.includes('n')) {
        const maxDy = crop.height - 20
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
          height: Math.round(newHeight)
        }
      })
    }
  }, [isDragging, dragType, resizeHandle, imageWidth, imageHeight, onChange])

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

  const displayCrop = {
    x: crop.x * scale,
    y: crop.y * scale,
    width: crop.width * scale,
    height: crop.height * scale
  }

  const handleStyle: React.CSSProperties = {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: '#007AFF',
    border: '2px solid white',
    borderRadius: 2,
    cursor: 'pointer',
    zIndex: 10
  }

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
        width: displaySize.width,
        height: displaySize.height,
        cursor: isDragging ? 'grabbing' : 'default',
        userSelect: 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: displayCrop.x,
          top: displayCrop.y,
          width: displayCrop.width,
          height: displayCrop.height,
          backgroundColor: 'transparent',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          cursor: 'move'
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
          pointerEvents: 'none'
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
