/**
 * 全屏图片查看器主组件
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import ImageCanvas from './components/ImageCanvas'
import InfoPanel from './components/InfoPanel'
import { useImageLoader } from './hooks/useImageLoader'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import type { ImageViewerProps, ViewMode } from './types'
import './ImageViewer.css'

const ImageViewer: React.FC<ImageViewerProps> = ({
  images,
  currentIndex: initialIndex,
  onIndexChange,
  onClose,
  onImageEdit,
  onTagsUpdate,
  onDescriptionUpdate,
  onImageDelete,
  onImageRotate,
  onImageFlip
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [scale, setScale] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [flipHorizontal, setFlipHorizontal] = useState(false)
  const [flipVertical, setFlipVertical] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('fit')

  const currentImage = useMemo(() => {
    return images[currentIndex] || null
  }, [images, currentIndex])

  // 确保 URL 不为空字符串时才传递给 useImageLoader
  const imageUrl = useMemo(() => {
    const url = currentImage?.url
    if (url && url.trim() !== '') {
      // 允许所有有效的 URL 格式，包括 http/https 和 data URL
      return url
    }
    return null
  }, [currentImage?.url])

  const { isLoading, isError, retry } = useImageLoader(imageUrl)
  
  // 当图片切换时，重置状态
  useEffect(() => {
    if (currentImage) {
      // 如果图片有 URL 但尺寸为 0，说明图片信息可能还未加载完成
      // 这种情况不需要特殊处理，因为图片加载完成后会自动更新
      // 但我们需要确保在图片切换时重置视图状态
      if (imageUrl) {
        // 图片 URL 存在，重置视图状态
        setScale(100)
        setRotation(0)
        setFlipHorizontal(false)
        setFlipVertical(false)
        setViewMode('fit')
      }
    }
  }, [currentImage?.id, imageUrl])

  // 当外部传入的currentIndex变化时，更新内部状态
  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < images.length) {
      setCurrentIndex(initialIndex)
      // 重置变换状态
      setScale(100)
      setRotation(0)
      setFlipHorizontal(false)
      setFlipVertical(false)
      setViewMode('fit')
    }
  }, [initialIndex, images.length])

  // 导航功能
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      setCurrentIndex(newIndex)
      if (onIndexChange) {
        onIndexChange(newIndex)
      }
    }
  }, [currentIndex, onIndexChange])

  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)
      if (onIndexChange) {
        onIndexChange(newIndex)
      }
    }
  }, [currentIndex, images.length, onIndexChange])

  // 变换功能
  const handleRotate = useCallback(() => {
    const newRotation = (rotation + 90) % 360
    setRotation(newRotation)
    if (currentImage && onImageRotate) {
      onImageRotate(currentImage.id, newRotation)
    }
  }, [rotation, currentImage, onImageRotate])

  const handleFlipHorizontal = useCallback(() => {
    const newFlip = !flipHorizontal
    setFlipHorizontal(newFlip)
    if (currentImage && onImageFlip) {
      onImageFlip(currentImage.id, 'horizontal')
    }
  }, [flipHorizontal, currentImage, onImageFlip])

  const handleFlipVertical = useCallback(() => {
    const newFlip = !flipVertical
    setFlipVertical(newFlip)
    if (currentImage && onImageFlip) {
      onImageFlip(currentImage.id, 'vertical')
    }
  }, [flipVertical, currentImage, onImageFlip])

  const handleReset = useCallback(() => {
    setScale(100)
    setRotation(0)
    setFlipHorizontal(false)
    setFlipVertical(false)
    setViewMode('fit')
  }, [])

  // 描述和标签更新
  const handleDescriptionSave = useCallback((description: string) => {
    if (currentImage) {
      if (onDescriptionUpdate) {
        onDescriptionUpdate(currentImage.id, description)
      }
      if (onImageEdit) {
        onImageEdit(currentImage.id, { description })
      }
    }
  }, [currentImage, onDescriptionUpdate, onImageEdit])

  const handleTagsChange = useCallback((tags: string[]) => {
    if (currentImage) {
      if (onTagsUpdate) {
        onTagsUpdate(currentImage.id, tags)
      }
      if (onImageEdit) {
        onImageEdit(currentImage.id, { tags })
      }
    }
  }, [currentImage, onTagsUpdate, onImageEdit])

  // 删除功能
  const handleDelete = useCallback(() => {
    if (currentImage && onImageDelete) {
      if (window.confirm('确定要删除这张图片吗？')) {
        onImageDelete(currentImage.id)
        // 删除后切换到下一张或上一张
        if (currentIndex < images.length - 1) {
          handleNext()
        } else if (currentIndex > 0) {
          handlePrev()
        } else {
          // 最后一张，关闭查看器
          if (onClose) {
            onClose()
          }
        }
      }
    }
  }, [currentImage, currentIndex, images.length, onImageDelete, onClose, handleNext, handlePrev])

  // 下载功能
  const handleDownload = useCallback(() => {
    if (currentImage) {
      const link = document.createElement('a')
      link.href = currentImage.url
      link.download = currentImage.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }, [currentImage])

  // 收藏功能（可选）
  const handleFavorite = useCallback(() => {
    // 这里可以添加收藏逻辑
    console.log('收藏功能待实现')
  }, [])

  // 键盘快捷键
  useKeyboardShortcuts({
    onEscape: onClose,
    onArrowLeft: handlePrev,
    onArrowRight: handleNext,
    onKeyR: handleRotate,
    onKeyF: () => setViewMode(viewMode === 'fit' ? 'free' : 'fit'),
    onKey1: () => setViewMode('actual'),
    onPlus: () => setScale(prev => Math.min(prev + 10, 500)),
    onMinus: () => setScale(prev => Math.max(prev - 10, 20)),
    enabled: true
  })

  if (images.length === 0) {
    return null
  }

  return (
    <div className="image-viewer">
      <div className="image-viewer-container">
        {/* 左侧：图片展示区域 */}
        <div className="image-viewer-canvas-wrapper">
          <ImageCanvas
            imageUrl={imageUrl}
            imageWidth={currentImage?.width || 0}
            imageHeight={currentImage?.height || 0}
            scale={scale}
            rotation={rotation}
            flipHorizontal={flipHorizontal}
            flipVertical={flipVertical}
            viewMode={viewMode}
            onScaleChange={setScale}
            onRotationChange={setRotation}
            onFlipChange={(h, v) => {
              setFlipHorizontal(h)
              setFlipVertical(v)
            }}
            onViewModeChange={setViewMode}
            isLoading={isLoading}
            isError={isError}
            onRetry={retry}
          />
        </div>

        {/* 右侧：信息面板 */}
        <div className="image-viewer-info-wrapper">
          <InfoPanel
            image={currentImage}
            currentIndex={currentIndex}
            totalCount={images.length}
            rotation={rotation}
            flipHorizontal={flipHorizontal}
            flipVertical={flipVertical}
            onDescriptionSave={handleDescriptionSave}
            onTagsChange={handleTagsChange}
            onPrev={handlePrev}
            onNext={handleNext}
            onRotate={handleRotate}
            onFlipHorizontal={handleFlipHorizontal}
            onFlipVertical={handleFlipVertical}
            onReset={handleReset}
            onDelete={handleDelete}
            onDownload={handleDownload}
            onFavorite={handleFavorite}
          />
        </div>
      </div>

      {/* 关闭按钮 */}
      {onClose && (
        <button
          className="image-viewer-close"
          onClick={onClose}
          title="关闭 (ESC)"
          aria-label="关闭图片查看器"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default ImageViewer

