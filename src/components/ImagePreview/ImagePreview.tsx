import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Modal, Button, Space, Empty, Tooltip } from 'antd'
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ReloadOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons'
import './ImagePreview.css'

export interface ImageSource {
  /** 图片URL或base64数据 */
  src: string
  /** 图片标题（可选） */
  title?: string
  /** 图片描述（可选） */
  description?: string
}

export interface ImagePreviewProps {
  /** 是否显示预览框 */
  visible: boolean
  /** 当前显示的图片索引（当images为数组时使用） */
  currentIndex?: number
  /** 单个图片源（字符串URL或base64） */
  image?: string
  /** 图片列表（支持多图浏览） */
  images?: ImageSource[] | string[]
  /** 关闭预览框的回调 */
  onClose?: () => void
  /** 图片切换回调（当使用图片列表时） */
  onIndexChange?: (index: number) => void
  /** 图片加载完成回调 */
  onLoad?: (index: number) => void
  /** 图片加载失败回调 */
  onError?: (index: number, error: Error) => void
  /** 是否显示工具栏（默认true） */
  showToolbar?: boolean
  /** 是否显示导航按钮（默认true，当images为数组时） */
  showNavigation?: boolean
  /** 是否启用键盘快捷键（默认true） */
  enableKeyboard?: boolean
  /** 自定义Modal宽度 */
  width?: number | string
  /** 最小缩放比例（默认20） */
  minScale?: number
  /** 最大缩放比例（默认300） */
  maxScale?: number
  /** 缩放步进值（默认20） */
  scaleStep?: number
  /** 旋转步进值（默认90） */
  rotationStep?: number
  /** 自定义类名 */
  className?: string
}

/**
 * 图片预览组件
 * 
 * 支持单个图片或图片列表预览，提供缩放、旋转、导航等功能
 */
const ImagePreview: React.FC<ImagePreviewProps> = ({
  visible,
  currentIndex = 0,
  image,
  images,
  onClose,
  onIndexChange,
  onLoad,
  onError,
  showToolbar = true,
  showNavigation = true,
  enableKeyboard = true,
  width = 800,
  minScale = 10,
  maxScale = 400,
  scaleStep = 20,
  rotationStep = 90,
  className = ''
}) => {
  // 图片列表处理
  const imageList: ImageSource[] = React.useMemo(() => {
    if (images) {
      return images.map((img, idx) => {
        if (typeof img === 'string') {
          return { src: img, title: `图片 ${idx + 1}` }
        }
        return img
      })
    }
    if (image) {
      return [{ src: image, title: '图片预览' }]
    }
    return []
  }, [images, image])

  // 状态管理
  const [scale, setScale] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [actualIndex, setActualIndex] = useState(currentIndex)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 })
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 })

  // 当前显示的图片（基于actualIndex）
  const currentImage = React.useMemo(() => {
    if (actualIndex >= 0 && actualIndex < imageList.length) {
      return imageList[actualIndex]
    }
    return null
  }, [actualIndex, imageList])
  
  const hasMultipleImages = imageList.length > 1

  // 当currentIndex变化时更新actualIndex
  useEffect(() => {
    if (visible && currentIndex >= 0 && currentIndex < imageList.length) {
      setActualIndex(currentIndex)
      // 重置状态
      setScale(100)
      setRotation(0)
      setLoadError(false)
      // 如果图片src已存在，不需要显示加载状态
      const targetImage = imageList[currentIndex]
      setIsLoading(!targetImage?.src)
    }
  }, [currentIndex, visible, imageList])

  // 当visible变化时重置状态
  useEffect(() => {
    if (!visible) {
      setScale(100)
      setRotation(0)
      setLoadError(false)
      setIsLoading(false)
      setLoadProgress(0)
    } else if (visible) {
      setLoadError(false)
      setLoadProgress(0)
    }
  }, [visible, currentImage])

  // 当currentImage的src更新时，应该显示加载状态
  useEffect(() => {
    if (visible && currentImage?.src) {
      setLoadError(false)
    }
  }, [visible, currentImage?.src])

  // 预加载图片并检查是否已缓存
  useEffect(() => {
    if (!visible || !currentImage?.src) return

    setLoadProgress(0)
    setIsLoading(true)

    const xhr = new XMLHttpRequest()
    xhr.open('GET', currentImage.src, true)
    xhr.responseType = 'blob'

    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100)
        setLoadProgress(progress)
      }
    }

    xhr.onload = () => {
      setIsLoading(false)
      setLoadProgress(100)
      setLoadError(false)
      const img = new Image()
      img.onload = () => {
        setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.src = URL.createObjectURL(xhr.response)
    }

    xhr.onerror = () => {
      setIsLoading(false)
    }

    xhr.send()

    const img = new Image()
    img.onload = () => {
      setIsLoading(false)
      setLoadError(false)
      setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {}
    img.src = currentImage.src

    if (img.complete) {
      setIsLoading(false)
      setLoadError(false)
      setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
  }, [visible, currentImage?.src])

  // 监听容器尺寸变化
  useEffect(() => {
    if (!containerRef.current) return

    const updateContainerSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current
        setContainerSize({ width: clientWidth, height: clientHeight })
      }
    }

    updateContainerSize()

    const resizeObserver = new ResizeObserver(updateContainerSize)
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [visible])

  // 计算适应容器的初始缩放比例
  const calculateFitScale = useCallback(() => {
    if (containerSize.width === 0 || containerSize.height === 0 || 
        imageNaturalSize.width === 0 || imageNaturalSize.height === 0) {
      return 100
    }

    const padding = 10
    const availableWidth = containerSize.width - padding * 2
    const availableHeight = containerSize.height - padding * 2

    const scaleX = (availableWidth / imageNaturalSize.width) * 100
    const scaleY = (availableHeight / imageNaturalSize.height) * 100

    return Math.min(scaleX, scaleY)
  }, [containerSize, imageNaturalSize])

  // 当图片尺寸或容器尺寸变化时，计算并设置适应容器的初始缩放比例
  useEffect(() => {
    if (!visible || !currentImage?.src) return
    if (containerSize.width === 0 || containerSize.height === 0) return

    const timer = setTimeout(() => {
      const fitScale = calculateFitScale()
      setScale(fitScale)
    }, 100)

    return () => clearTimeout(timer)
  }, [visible, currentImage?.src, containerSize, imageNaturalSize, calculateFitScale])

  // 判断图片方向：横向或竖向
  const isLandscape = imageNaturalSize.width >= imageNaturalSize.height

  // 图片加载处理
  const handleImageLoad = useCallback((e: any) => {
    setIsLoading(false)
    setLoadError(false)
    const target = e.target
    if (target.naturalWidth > 0 && target.naturalHeight > 0) {
      setImageNaturalSize({ width: target.naturalWidth, height: target.naturalHeight })
    }
    if (onLoad) {
      onLoad(actualIndex)
    }
  }, [actualIndex, onLoad])

  const handleImageError = useCallback(() => {
    setIsLoading(false)
    setLoadError(true)
    const error = new Error('图片加载失败')
    if (onError) {
      onError(actualIndex, error)
    }
  }, [actualIndex, onError])

  // 缩放功能
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + scaleStep, maxScale))
  }, [scaleStep, maxScale])

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - scaleStep, minScale))
  }, [scaleStep, minScale])

  // 旋转功能
  const handleRotateLeft = useCallback(() => {
    setRotation(prev => prev - rotationStep)
  }, [rotationStep])

  const handleRotateRight = useCallback(() => {
    setRotation(prev => prev + rotationStep)
  }, [rotationStep])

  // 重置所有
  const handleResetAll = useCallback(() => {
    setScale(100)
    setRotation(0)
    setImageOffset({ x: 0, y: 0 })
  }, [])

  // 导航功能
  const handlePrev = useCallback(() => {
    if (actualIndex > 0) {
      const newIndex = actualIndex - 1
      setActualIndex(newIndex)
      setScale(100)
      setRotation(0)
      setImageOffset({ x: 0, y: 0 })
      setLoadError(false)
      setIsLoading(true)
      setLoadProgress(0)
      if (onIndexChange) {
        onIndexChange(newIndex)
      }
    }
  }, [actualIndex, onIndexChange])

  const handleNext = useCallback(() => {
    if (actualIndex < imageList.length - 1) {
      const newIndex = actualIndex + 1
      setActualIndex(newIndex)
      setScale(100)
      setRotation(0)
      setImageOffset({ x: 0, y: 0 })
      setLoadError(false)
      setIsLoading(true)
      setLoadProgress(0)
      if (onIndexChange) {
        onIndexChange(newIndex)
      }
    }
  }, [actualIndex, imageList.length, onIndexChange])

  // 重试加载
  const handleRetry = useCallback(() => {
    setLoadError(false)
    setIsLoading(true)
    setLoadProgress(0)
    // 触发图片重新加载
    const img = new Image()
    img.onload = handleImageLoad
    img.onerror = () => handleImageError()
    if (currentImage) {
      img.src = currentImage.src
    }
  }, [currentImage, handleImageLoad, handleImageError])

  // 关闭处理
  const handleClose = useCallback(() => {
    handleResetAll()
    setImageOffset({ x: 0, y: 0 })
    if (onClose) {
      onClose()
    }
  }, [onClose, handleResetAll])

  // 拖拽功能
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: imageOffset.x,
      offsetY: imageOffset.y
    }
  }, [imageOffset])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y
    setImageOffset({
      x: dragStartRef.current.offsetX + deltaX,
      y: dragStartRef.current.offsetY + deltaY
    })
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 键盘快捷键
  useEffect(() => {
    if (!visible || !enableKeyboard) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc键关闭
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
        return
      }

      // 导航快捷键
      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handlePrev()
        return
      }
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleNext()
        return
      }

      // 缩放和旋转快捷键（Ctrl/Cmd + 按键）
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '+':
          case '=':
            e.preventDefault()
            handleZoomIn()
            break
          case '-':
          case '_':
            e.preventDefault()
            handleZoomOut()
            break
          case 'ArrowLeft':
            e.preventDefault()
            handleRotateLeft()
            break
          case 'ArrowRight':
            e.preventDefault()
            handleRotateRight()
            break
          case '0':
            e.preventDefault()
            handleResetAll()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    visible,
    enableKeyboard,
    handleClose,
    handlePrev,
    handleNext,
    handleZoomIn,
    handleZoomOut,
    handleRotateLeft,
    handleRotateRight,
    handleResetAll
  ])

  // 如果没有图片，不显示
  if (!currentImage) {
    return null
  }

  // 计算旋转角度（规范化到0-360度）
  const normalizedRotation = ((rotation % 360) + 360) % 360

  return (
    <Modal
      title={
        <Space>
          <span>图片预览</span>
          {currentImage.title && (
            <span style={{ fontSize: 12, color: '#999' }}>{currentImage.title}</span>
          )}
          {hasMultipleImages && (
            <span style={{ fontSize: 12, color: '#999' }}>
              ({actualIndex + 1} / {imageList.length})
            </span>
          )}
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={width}
      style={{ top: '5%', position: 'relative', height: 'auto', maxHeight: '90vh' }}
      className={`image-preview-modal ${className}`}
    >
      <div ref={containerRef} className="image-preview-container">
        {/* 状态显示 */}
        <div className="image-preview-status">
          <Space>
            <span>缩放：{scale}%</span>
            <span>旋转：{normalizedRotation}°</span>
          </Space>
        </div>

        {/* 加载状态指示器 */}
        {isLoading && (
          <div className="image-preview-loading">
            <svg className="circular-progress" viewBox="0 0 100 100">
              <circle
                className="circular-progress-bg"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="8"
              />
              <circle
                className="circular-progress-fill"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="8"
                strokeDasharray={`${loadProgress * 2.83} 283`}
                strokeLinecap="round"
              />
            </svg>
            <span>{loadProgress}%</span>
          </div>
        )}

        {/* 图片显示 */}
        {!loadError && currentImage?.src && (
          <img
            key={currentImage?.src}
            src={currentImage.src}
            alt={currentImage.title || '预览'}
            className={`image-preview-img ${isLandscape ? 'landscape' : 'portrait'} ${isDragging ? 'dragging' : ''}`}
            style={{
              transform: `translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${scale / 100}) rotate(${rotation}deg)`,
              opacity: isLoading ? 0 : 1,
              display: 'block',
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        )}

        {/* 错误处理 */}
        {loadError && (
          <div className="image-preview-error">
            <div className="image-preview-error-icon">❌</div>
            <div>图片加载失败</div>
            <Button type="primary" onClick={handleRetry}>
              重试
            </Button>
          </div>
        )}

        {/* 初始加载状态 */}
        {!currentImage.src && !isLoading && !loadError && (
          <Empty description="准备加载图片..." />
        )}
      </div>

      {/* 底部卡片化操作工具栏 */}
      {showToolbar && (
        <div className="image-preview-footer">
          {/* 缩放控制组 */}
          <div className="image-preview-toolbar-group">
            <Tooltip title="缩小">
              <Button
                icon={<ZoomOutOutlined />}
                onClick={handleZoomOut}
                disabled={scale <= minScale}
              />
            </Tooltip>
            <span className="image-preview-toolbar-label">{scale}%</span>
            <Tooltip title="放大">
              <Button
                icon={<ZoomInOutlined />}
                onClick={handleZoomIn}
                disabled={scale >= maxScale}
              />
            </Tooltip>
          </div>

          <div className="image-preview-toolbar-divider" />

          {/* 旋转控制组 */}
          <div className="image-preview-toolbar-group">
            <Tooltip title="向左旋转">
              <Button
                icon={<RotateLeftOutlined />}
                onClick={handleRotateLeft}
              />
            </Tooltip>
            <span className="image-preview-toolbar-label">{normalizedRotation}°</span>
            <Tooltip title="向右旋转">
              <Button
                icon={<RotateRightOutlined />}
                onClick={handleRotateRight}
              />
            </Tooltip>
          </div>

          <div className="image-preview-toolbar-divider" />

          {/* 重置按钮 */}
          <div className="image-preview-toolbar-group">
            <Tooltip title="重置缩放和旋转">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleResetAll}
              />
            </Tooltip>
          </div>

          {hasMultipleImages && showNavigation && (
            <>
              <div className="image-preview-toolbar-divider" />

              {/* 导航控制 */}
              <div className="image-preview-nav-buttons">
                <Tooltip title="上一张">
                  <Button
                    icon={<LeftOutlined />}
                    onClick={handlePrev}
                    disabled={actualIndex <= 0}
                  >
                    上一张
                  </Button>
                </Tooltip>
                <div className="image-preview-info-badge">
                  {actualIndex + 1} / {imageList.length}
                </div>
                <Tooltip title="下一张">
                  <Button
                    icon={<RightOutlined />}
                    onClick={handleNext}
                    disabled={actualIndex >= imageList.length - 1}
                  >
                    下一张
                  </Button>
                </Tooltip>
              </div>
            </>
          )}

          <div className="image-preview-toolbar-divider" />

          {/* 关闭按钮 */}
          <div className="image-preview-close-btn">
            <Button type="primary" onClick={handleClose}>
              关闭
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ImagePreview

