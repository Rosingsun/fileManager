/**
 * 图片展示区域组件
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { ViewMode } from '../types'
import { calculateFitScale, clamp } from '../../../utils'
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

const ELASTIC_BUFFER = 0.2
const SPRING_STIFFNESS = 0.3
const DAMPING = 0.8
const DRAG_STEP = 30

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
  onViewModeChange,
  isLoading = false,
  isError = false,
  onRetry
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, positionX: 0, positionY: 0 })
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const velocityRef = useRef({ x: 0, y: 0 })
  const animationFrameRef = useRef<number | null>(null)

  // 计算旋转后的图片尺寸
  const getRotatedSize = useCallback((width: number, height: number, rotation: number) => {
    const radians = (rotation * Math.PI) / 180
    const absCos = Math.abs(Math.cos(radians))
    const absSin = Math.abs(Math.sin(radians))
    return {
      width: width * absCos + height * absSin,
      height: width * absSin + height * absCos
    }
  }, [])

  // 计算弹性边界
  const getElasticBounds = useCallback((isDragging: boolean) => {
    const scaledWidth = (imageWidth * scale) / 100
    const scaledHeight = (imageHeight * scale) / 100
    
    const rotatedSize = getRotatedSize(scaledWidth, scaledHeight, rotation)
    
    const contentWidth = Math.max(rotatedSize.width, containerSize.width)
    const contentHeight = Math.max(rotatedSize.height, containerSize.height)
    
    const overflowX = (contentWidth - containerSize.width) / 2
    const overflowY = (contentHeight - containerSize.height) / 2
    
    const bufferX = isDragging ? Math.max(overflowX * ELASTIC_BUFFER, 30) : 0
    const bufferY = isDragging ? Math.max(overflowY * ELASTIC_BUFFER, 30) : 0
    
    return {
      minX: -(overflowX + bufferX),
      maxX: overflowX + bufferX,
      minY: -(overflowY + bufferY),
      maxY: overflowY + bufferY
    }
  }, [imageWidth, imageHeight, scale, containerSize, rotation, getRotatedSize])

  // 弹性回弹动画
  const startSpringAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    const animate = () => {
      const bounds = getElasticBounds(false)
      const isInBounds = position.x >= bounds.minX && position.x <= bounds.maxX && 
                        position.y >= bounds.minY && position.y <= bounds.maxY
      
      if (isInBounds && Math.abs(velocityRef.current.x) < 0.1 && Math.abs(velocityRef.current.y) < 0.1) {
        animationFrameRef.current = null
        return
      }
      
      let targetX = clamp(position.x, bounds.minX, bounds.maxX)
      let targetY = clamp(position.y, bounds.minY, bounds.maxY)
      
      velocityRef.current.x += (targetX - position.x) * SPRING_STIFFNESS
      velocityRef.current.y += (targetY - position.y) * SPRING_STIFFNESS
      
      velocityRef.current.x *= DAMPING
      velocityRef.current.y *= DAMPING
      
      const newX = position.x + velocityRef.current.x
      const newY = position.y + velocityRef.current.y
      
      setPosition({ x: newX, y: newY })
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    
    animate()
  }, [position, getElasticBounds])

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

  // 清理动画
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // 计算适应屏幕的缩放比例
  const fitScale = useMemo(() => {
    if (containerSize.width > 0 && containerSize.height > 0 && imageWidth > 0 && imageHeight > 0) {
      const rotatedSize = getRotatedSize(imageWidth, imageHeight, rotation)
      return calculateFitScale(rotatedSize.width, rotatedSize.height, containerSize.width, containerSize.height)
    }
    return 100
  }, [containerSize.width, containerSize.height, imageWidth, imageHeight, rotation, getRotatedSize])

  // 根据视图模式调整缩放
  useEffect(() => {
    if (viewMode === 'fit') {
      onScaleChange(fitScale)
      requestAnimationFrame(() => {
        setPosition({ x: 0, y: 0 })
      })
    } else if (viewMode === 'actual') {
      onScaleChange(100)
      requestAnimationFrame(() => {
        setPosition({ x: 0, y: 0 })
      })
    }
  }, [viewMode, fitScale, onScaleChange])

  // 当容器尺寸变化且当前是适应模式时，重新计算适应缩放比例
  useEffect(() => {
    if (viewMode === 'fit' && containerSize.width > 0 && containerSize.height > 0) {
      onScaleChange(fitScale)
      setPosition({ x: 0, y: 0 })
    }
  }, [containerSize, viewMode, fitScale, onScaleChange])
  
  // 当图片切换或尺寸变化时，重置位置到中心
  useEffect(() => {
    if (imageUrl && imageWidth > 0 && imageHeight > 0) {
      // 图片加载完成或切换时，重置到中心位置
      setPosition({ x: 0, y: 0 })
    }
  }, [imageUrl, imageWidth, imageHeight])
  
  // 当缩放改变时，限制位置在边界内
  useEffect(() => {
    if (viewMode === 'free' && containerSize.width > 0 && containerSize.height > 0) {
      const scaledWidth = (imageWidth * scale) / 100
      const scaledHeight = (imageHeight * scale) / 100
      const rotatedSize = getRotatedSize(scaledWidth, scaledHeight, rotation)
      
      const maxX = Math.max(0, (rotatedSize.width - containerSize.width) / 2)
      const maxY = Math.max(0, (rotatedSize.height - containerSize.height) / 2)
      
      setPosition(prev => ({
        x: clamp(prev.x, -maxX, maxX),
        y: clamp(prev.y, -maxY, maxY)
      }))
    }
  }, [scale, imageWidth, imageHeight, containerSize, viewMode, rotation, getRotatedSize])

  // 鼠标滚轮缩放 - 以鼠标位置为中心缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (viewMode === 'fit') {
      onViewModeChange('free')
    }

    e.preventDefault()
    
    if (!containerRef.current) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - containerRect.left
    const mouseY = e.clientY - containerRect.top
    
    const containerCenterX = containerRect.width / 2
    const containerCenterY = containerRect.height / 2
    
    const imageCenterX = containerCenterX + position.x
    const imageCenterY = containerCenterY + position.y
    
    const relativeX = (mouseX - imageCenterX) / (scale / 100)
    const relativeY = (mouseY - imageCenterY) / (scale / 100)
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = clamp(scale * zoomFactor, 20, 500)
    
    const newImageCenterX = mouseX - relativeX * (newScale / 100)
    const newImageCenterY = mouseY - relativeY * (newScale / 100)
    
    const newPositionX = newImageCenterX - containerCenterX
    const newPositionY = newImageCenterY - containerCenterY
    
    const newScaledWidth = (imageWidth * newScale) / 100
    const newScaledHeight = (imageHeight * newScale) / 100
    const rotatedSize = getRotatedSize(newScaledWidth, newScaledHeight, rotation)
    
    const maxX = Math.max(0, (rotatedSize.width - containerRect.width) / 2)
    const maxY = Math.max(0, (rotatedSize.height - containerRect.height) / 2)
    
    const clampedX = clamp(newPositionX, -maxX, maxX)
    const clampedY = clamp(newPositionY, -maxY, maxY)
    
    setPosition({ x: clampedX, y: clampedY })
    onScaleChange(newScale)
  }, [scale, viewMode, onScaleChange, onViewModeChange, imageWidth, imageHeight, position, rotation, getRotatedSize])

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
    if (e.button !== 0) return
    
    if (!containerRef.current) return
    
    const scaledWidth = (imageWidth * scale) / 100
    const scaledHeight = (imageHeight * scale) / 100
    
    if (scaledWidth > containerSize.width || scaledHeight > containerSize.height) {
      setIsDragging(true)
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        positionX: position.x,
        positionY: position.y
      }
      velocityRef.current = { x: 0, y: 0 }
      
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [imageWidth, imageHeight, scale, containerSize, position])

  // 计算步进后的位置（实现"一卡一卡"效果）
  const getSteppedPosition = useCallback((_currentPos: number, startPos: number, delta: number): number => {
    const totalDelta = startPos + delta
    const stepped = Math.round(totalDelta / DRAG_STEP) * DRAG_STEP
    return stepped
  }, [])

  // 拖拽中
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const deltaX = e.clientX - dragStartRef.current.mouseX
    const deltaY = e.clientY - dragStartRef.current.mouseY

    const steppedX = getSteppedPosition(position.x, dragStartRef.current.positionX, deltaX)
    const steppedY = getSteppedPosition(position.y, dragStartRef.current.positionY, deltaY)

    const bounds = getElasticBounds(true)
    
    const newX = clamp(steppedX, bounds.minX, bounds.maxX)
    const newY = clamp(steppedY, bounds.minY, bounds.maxY)

    velocityRef.current = { x: newX - position.x, y: newY - position.y }

    setPosition({ x: newX, y: newY })
  }, [isDragging, position, getElasticBounds, getSteppedPosition])

  // 拖拽结束
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      startSpringAnimation()
    }
  }, [isDragging, startSpringAnimation])

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
  // 使用绝对定位确保图片居中，然后通过 transform 进行偏移和变换
  // transform 的顺序很重要：
  // 1. translate(-50%, -50%) - 将图片中心移到容器中心（相对于图片自身尺寸）
  // 2. translate(position.x, position.y) - 应用用户拖拽的偏移
  // 3. scale() - 应用缩放
  // 4. rotate() - 应用旋转
  // 5. scaleX/scaleY - 应用翻转
  const imageStyle: React.CSSProperties = useMemo(() => {
    // 如果图片尺寸为 0，使用 auto 让浏览器自动计算
    // 否则使用明确的尺寸
    const style: React.CSSProperties = {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale / 100}) rotate(${rotation}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`,
      transformOrigin: 'center center',
      transition: isDragging ? 'none' : 'transform 0.2s ease-out',
      userSelect: 'none',
      zIndex: 1
    }
    
    // 只有当尺寸大于 0 时才设置明确的宽度和高度
    // 否则让浏览器根据图片的自然尺寸自动计算
    if (imageWidth > 0) {
      style.width = `${imageWidth}px`
    }
    if (imageHeight > 0) {
      style.height = `${imageHeight}px`
    }
    
    return style
  }, [imageWidth, imageHeight, position.x, position.y, scale, rotation, flipHorizontal, flipVertical, isDragging])

  return (
    <div
      ref={containerRef}
      className="image-canvas"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {isLoading && imageWidth > 0 && imageHeight > 0 ? (
        <div 
          className="image-canvas-loading"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale / 100})`,
            transformOrigin: 'center center',
            zIndex: 10
          }}
        >
          <div className="image-canvas-spinner"></div>
          <span>正在加载图片...</span>
        </div>
      ) : isLoading ? (
        <div className="image-canvas-loading">
          <div className="image-canvas-spinner"></div>
          <span>正在加载图片...</span>
        </div>
      ) : null}

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
            // 确保图片在加载过程中不可见，加载完成后平滑显示
            opacity: isLoading ? 0 : 1,
            visibility: isLoading ? 'hidden' : 'visible',
            transition: isLoading ? 'none' : 'opacity 0.3s ease-out, transform 0.2s ease-out'
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
            
            // 如果传入的尺寸为 0，但图片已经加载，尝试从自然尺寸更新
            if ((imageWidth === 0 || imageHeight === 0) && naturalWidth > 0 && naturalHeight > 0) {
              console.warn('[ImageCanvas] 图片尺寸为 0，但图片已加载，自然尺寸:', naturalWidth, 'x', naturalHeight)
            }
          }}
          onError={() => {
            console.error('[ImageCanvas] 图片加载失败:', imageUrl.substring(0, 50) + '...')
            // 错误处理由 useImageLoader 统一管理
          }}
        />
      )}
    </div>
  )
}

export default ImageCanvas

