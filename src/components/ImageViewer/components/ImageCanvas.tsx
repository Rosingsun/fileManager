/**
 * 图片展示区域组件
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { ViewMode } from '../types'
import './ImageCanvas.css'

const MIN_SCALE = 1
const MAX_SCALE = 400

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

export interface ImageCanvasProps {
  imageUrl: string | null
  imageWidth: number
  imageHeight: number
  scale: number
  rotation: number
  flipHorizontal: boolean
  flipVertical: boolean
  viewMode: ViewMode
  backgroundColor: string | null
  onScaleChange: (scale: number) => void
  onRotationChange: (rotation: number) => void
  onFlipChange: (horizontal: boolean, vertical: boolean) => void
  onViewModeChange: (mode: ViewMode) => void
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({
  imageUrl,
  imageWidth,
  imageHeight,
  scale,
  rotation,
  flipHorizontal,
  flipVertical,
  viewMode,
  backgroundColor,
  onScaleChange,
  onViewModeChange,
  isLoading = false,
  isError = false,
  onRetry
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const positionRef = useRef({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const lastViewModeRef = useRef<ViewMode>('fit')

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }

    updateSize()
    const resizeObserver = new ResizeObserver(updateSize)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }
    return () => resizeObserver.disconnect()
  }, [])

  const calculateFitScale = useCallback((
    imgW: number,
    imgH: number,
    contW: number,
    contH: number,
    ratio: number = 0.5
  ): number => {
    if (imgW === 0 || imgH === 0 || contW === 0 || contH === 0) return 50
    const scaleX = (contW * ratio) / imgW
    const scaleY = (contH * ratio) / imgH
    return Math.min(scaleX, scaleY) * 100
  }, [])

  const getRotatedSize = useCallback((width: number, height: number, rot: number) => {
    const radians = (rot * Math.PI) / 180
    const absCos = Math.abs(Math.cos(radians))
    const absSin = Math.abs(Math.sin(radians))
    return {
      width: width * absCos + height * absSin,
      height: width * absSin + height * absCos
    }
  }, [])

  const fitScale = useMemo(() => {
    if (containerSize.width > 0 && containerSize.height > 0 && imageWidth > 0 && imageHeight > 0) {
      const rotatedSize = getRotatedSize(imageWidth, imageHeight, rotation)
      return calculateFitScale(rotatedSize.width, rotatedSize.height, containerSize.width, containerSize.height, 0.5)
    }
    return 50
  }, [containerSize.width, containerSize.height, imageWidth, imageHeight, rotation, getRotatedSize, calculateFitScale])

  useEffect(() => {
    if (viewMode === 'fit' && lastViewModeRef.current !== 'fit') {
      onScaleChange(fitScale)
      positionRef.current = { x: 0, y: 0 }
    }
    lastViewModeRef.current = viewMode
  }, [viewMode, fitScale, onScaleChange])

  useEffect(() => {
    if (imageUrl && imageWidth > 0 && imageHeight > 0 && viewMode === 'fit') {
      positionRef.current = { x: 0, y: 0 }
    }
  }, [imageUrl, imageWidth, imageHeight, viewMode])

  const updateImageTransform = useCallback(() => {
    if (!imageRef.current) return
    const { x, y } = positionRef.current
    imageRef.current.style.transform = 
      `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale / 100}) rotate(${rotation}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`
  }, [scale, rotation, flipHorizontal, flipVertical])

  useEffect(() => {
    updateImageTransform()
  }, [scale, rotation, flipHorizontal, flipVertical, updateImageTransform])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (!containerRef.current) return

    if (viewMode === 'fit') {
      onViewModeChange('free')
    }
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - containerRect.left
    const mouseY = e.clientY - containerRect.top
    
    const containerCenterX = containerRect.width / 2
    const containerCenterY = containerRect.height / 2
    
    const imageCenterX = containerCenterX + positionRef.current.x
    const imageCenterY = containerCenterY + positionRef.current.y
    
    const relativeX = (mouseX - imageCenterX) / (scale / 100)
    const relativeY = (mouseY - imageCenterY) / (scale / 100)
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = clamp(scale * zoomFactor, MIN_SCALE, MAX_SCALE)
    
    const newImageCenterX = mouseX - relativeX * (newScale / 100)
    const newImageCenterY = mouseY - relativeY * (newScale / 100)
    
    const newPositionX = newImageCenterX - containerCenterX
    const newPositionY = newImageCenterY - containerCenterY
    
    positionRef.current = { x: newPositionX, y: newPositionY }
    updateImageTransform()
    onScaleChange(newScale)
  }, [scale, viewMode, onScaleChange, onViewModeChange, updateImageTransform])

  const handleDoubleClick = useCallback(() => {
    if (viewMode === 'fit') {
      onViewModeChange('free')
    } else {
      onScaleChange(fitScale)
      positionRef.current = { x: 0, y: 0 }
      updateImageTransform()
      onViewModeChange('fit')
    }
  }, [viewMode, onViewModeChange, onScaleChange, fitScale, updateImageTransform])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    setIsDragging(true)
    dragOffsetRef.current = { x: e.clientX, y: e.clientY }
    if (imageRef.current) {
      imageRef.current.style.transition = 'none'
      imageRef.current.style.cursor = 'grabbing'
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const deltaX = e.clientX - dragOffsetRef.current.x
    const deltaY = e.clientY - dragOffsetRef.current.y
    positionRef.current = {
      x: positionRef.current.x + deltaX,
      y: positionRef.current.y + deltaY
    }
    dragOffsetRef.current = { x: e.clientX, y: e.clientY }
    updateImageTransform()
  }, [isDragging, updateImageTransform])

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      if (imageRef.current) {
        imageRef.current.style.transition = 'transform 0.1s ease-out'
        imageRef.current.style.cursor = 'grab'
      }
    }
  }, [isDragging])

  const imageStyle: React.CSSProperties = useMemo(() => {
    const style: React.CSSProperties = {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: `translate(-50%, -50%) translate(${positionRef.current.x}px, ${positionRef.current.y}px) scale(${scale / 100}) rotate(${rotation}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`,
      transformOrigin: 'center center',
      transition: 'transform 0.1s ease-out',
      userSelect: 'none',
      zIndex: 1,
      cursor: 'grab'
    }
    
    if (imageWidth > 0) {
      style.width = `${imageWidth}px`
    }
    if (imageHeight > 0) {
      style.height = `${imageHeight}px`
    }
    
    return style
  }, [imageWidth, imageHeight, scale, rotation, flipHorizontal, flipVertical])

  return (
    <div
      ref={containerRef}
      className="image-canvas"
      style={backgroundColor ? { backgroundColor } : undefined}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {isLoading && (
        <div className="image-canvas-loading">
          <div className="image-canvas-spinner"></div>
          <span>正在加载图片...</span>
        </div>
      )}

      {isError && (
        <div className="image-canvas-error">
          <div className="image-canvas-error-icon">⚠️</div>
          <div className="image-canvas-error-text">图片加载失败</div>
          <div className="image-canvas-error-hint">请检查文件是否存在或权限是否正确</div>
          {onRetry && (
            <button className="image-canvas-retry-btn" onClick={onRetry}>
              重新加载
            </button>
          )}
        </div>
      )}

      {imageUrl && imageUrl.trim() !== '' && !isError && (
        <img
          ref={imageRef}
          src={imageUrl}
          alt="预览"
          className="image-canvas-img"
          style={{ 
            ...imageStyle,
            opacity: isLoading ? 0 : 1,
            visibility: isLoading ? 'hidden' : 'visible',
            transition: isLoading ? 'none' : 'opacity 0.3s ease-out, transform 0.1s ease-out'
          }}
          draggable={false}
          onLoad={() => {
            const img = imageRef.current
            const naturalWidth = img?.naturalWidth || 0
            const naturalHeight = img?.naturalHeight || 0
            console.log('[ImageCanvas] 图片加载完成:', {
              url: imageUrl.substring(0, 50) + '...',
              propsWidth: imageWidth,
              propsHeight: imageHeight,
              naturalWidth,
              naturalHeight,
              displayWidth: img?.offsetWidth,
              displayHeight: img?.offsetHeight,
              computedStyle: img ? window.getComputedStyle(img).transform : null
            })
            
            if ((imageWidth === 0 || imageHeight === 0) && naturalWidth > 0 && naturalHeight > 0) {
              console.warn('[ImageCanvas] 图片尺寸为 0，但图片已加载，自然尺寸:', naturalWidth, 'x', naturalHeight)
            }
          }}
          onError={() => {
            console.error('[ImageCanvas] 图片加载失败:', imageUrl.substring(0, 50) + '...')
          }}
        />
      )}
    </div>
  )
}

export default ImageCanvas
