/**
 * 图片展示区域组件
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { ViewMode } from '../types'
import { calculateFitScale, clamp } from '../utils/imageUtils'
import './ImageCanvas.css'

export interface ImageCanvasProps {
  imageUrl: string | null
  imageWidth: number
  imageHeight: number
  scale: number
  rotation: number
  flipHorizontal: boolean
  flipVertical: boolean
  viewMode: ViewMode
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
  onScaleChange,
  onRotationChange,
  onFlipChange,
  onViewModeChange,
  isLoading = false,
  isError = false,
  onRetry
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  // 监听容器大小变化
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({ width: rect.width, height: rect.height })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // 计算适应屏幕的缩放比例
  const fitScale = useMemo(() => {
    if (containerSize.width > 0 && containerSize.height > 0 && imageWidth > 0 && imageHeight > 0) {
      return calculateFitScale(imageWidth, imageHeight, containerSize.width, containerSize.height)
    }
    return 100
  }, [containerSize.width, containerSize.height, imageWidth, imageHeight])

  // 根据视图模式调整缩放
  useEffect(() => {
    if (viewMode === 'fit') {
      onScaleChange(fitScale)
      setPosition({ x: 0, y: 0 })
    } else if (viewMode === 'actual') {
      onScaleChange(100)
      setPosition({ x: 0, y: 0 })
    }
  }, [viewMode, fitScale, onScaleChange])

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (viewMode === 'fit') {
      onViewModeChange('free')
    }

    e.preventDefault()
    const delta = e.deltaY > 0 ? -10 : 10
    const newScale = clamp(scale + delta, 20, 500)
    onScaleChange(newScale)
  }, [scale, viewMode, onScaleChange, onViewModeChange])

  // 双击切换视图模式
  const handleDoubleClick = useCallback(() => {
    if (viewMode === 'fit' || viewMode === 'actual') {
      onViewModeChange('free')
    } else {
      onViewModeChange('fit')
    }
  }, [viewMode, onViewModeChange])

  // 拖拽开始
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // 只处理左键
    
    const scaledWidth = (imageWidth * scale) / 100
    const scaledHeight = (imageHeight * scale) / 100
    
    // 只有当图片超出容器时才允许拖拽
    if (scaledWidth > containerSize.width || scaledHeight > containerSize.height) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }, [imageWidth, imageHeight, scale, containerSize, position])

  // 拖拽中
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const scaledWidth = (imageWidth * scale) / 100
    const scaledHeight = (imageHeight * scale) / 100
    
    const maxX = Math.max(0, (scaledWidth - containerSize.width) / 2)
    const maxY = Math.max(0, (scaledHeight - containerSize.height) / 2)

    const newX = clamp(
      e.clientX - dragStart.x,
      -maxX,
      maxX
    )
    const newY = clamp(
      e.clientY - dragStart.y,
      -maxY,
      maxY
    )

    setPosition({ x: newX, y: newY })
  }, [isDragging, dragStart, imageWidth, imageHeight, scale, containerSize])

  // 拖拽结束
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
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

  // 计算图片变换样式
  const imageStyle: React.CSSProperties = {
    transform: `translate(${position.x}px, ${position.y}px) scale(${scale / 100}) rotate(${rotation}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`,
    transformOrigin: 'center center',
    transition: isDragging ? 'none' : 'transform 0.2s ease-out',
    userSelect: 'none',
    WebkitUserDrag: 'none'
  }

  return (
    <div
      ref={containerRef}
      className="image-canvas"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
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
          <div className="image-canvas-error-icon">❌</div>
          <div>图片加载失败</div>
          {onRetry && (
            <button className="image-canvas-retry-btn" onClick={onRetry}>
              重试
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
            // 确保图片在加载过程中不可见，加载完成后平滑显示
            opacity: isLoading ? 0 : 1,
            visibility: 'visible',
            transition: isLoading ? 'none' : 'opacity 0.3s ease-out'
          }}
          draggable={false}
          onError={(e) => {
            console.error('图片加载失败:', imageUrl.substring(0, 50) + '...')
            // 错误处理由 useImageLoader 统一管理
          }}
        />
      )}
    </div>
  )
}

export default ImageCanvas

