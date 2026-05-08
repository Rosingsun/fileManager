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
  onImageRotate,
  onImageFlip
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [scale, setScale] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [flipHorizontal, setFlipHorizontal] = useState(false)
  const [flipVertical, setFlipVertical] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('fit')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [isLoadingBlob, setIsLoadingBlob] = useState(false)
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null)

  const currentImage = useMemo(() => {
    return images[currentIndex] || null
  }, [images, currentIndex])

  // 处理 file:// URL，转换为 blob URL
  useEffect(() => {
    const loadBlobUrl = async () => {
      if (!currentImage?.url) {
        setBlobUrl(null)
        return
      }

      const url = currentImage.url
      
      // 如果已经是 data URL 或 blob URL，直接使用
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        setBlobUrl(url)
        return
      }

      // 如果是 file:// URL，从主进程读取图片数据
      if (url.startsWith('file://')) {
        setIsLoadingBlob(true)
        try {
          const filePath = url.replace('file://', '')
          if (window.electronAPI?.getImageBase64) {
            const base64Data = await window.electronAPI.getImageBase64(filePath)
            if (base64Data && base64Data.startsWith('data:image')) {
              setBlobUrl(base64Data)
            } else {
              setBlobUrl(null)
            }
          } else {
            setBlobUrl(null)
          }
        } catch (error) {
          console.error('读取图片文件失败:', error)
          setBlobUrl(null)
        } finally {
          setIsLoadingBlob(false)
        }
        return
      }

      setBlobUrl(null)
    }

    loadBlobUrl()
  }, [currentImage?.url])

  // 确定要传递给 ImageCanvas 的 URL
  const displayImageUrl = useMemo(() => {
    if (isLoadingBlob) {
      return null
    }
    if (blobUrl) {
      return blobUrl
    }
    return currentImage?.url || null
  }, [blobUrl, isLoadingBlob, currentImage?.url])

  // 调试日志
  useEffect(() => {
    console.log('[ImageViewer] currentImage:', {
      id: currentImage?.id,
      url: currentImage?.url?.substring(0, 50) + '...',
      filename: currentImage?.filename,
      width: currentImage?.width,
      height: currentImage?.height
    })
    console.log('[ImageViewer] displayImageUrl:', displayImageUrl)
    console.log('[ImageViewer] blobUrl:', blobUrl)
  }, [currentImage, displayImageUrl, blobUrl])

  const { isLoading, isError, retry, naturalWidth, naturalHeight } = useImageLoader(displayImageUrl)

  const infoPanelImage = useMemo(() => {
    if (!currentImage) return null
    const w = naturalWidth ?? currentImage.width
    const h = naturalHeight ?? currentImage.height
    if (w === currentImage.width && h === currentImage.height) {
      return currentImage
    }
    return { ...currentImage, width: w, height: h }
  }, [currentImage, naturalWidth, naturalHeight])

  // 当图片切换或 URL 变化时，重置状态
  useEffect(() => {
    if (currentImage && displayImageUrl) {
      // 图片 URL 存在，重置视图状态
      setScale(100)
      setRotation(0)
      setFlipHorizontal(false)
      setFlipVertical(false)
      setViewMode('fit')
    }
  }, [currentImage?.id, displayImageUrl])

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

  // 键盘快捷键
  useKeyboardShortcuts({
    onEscape: onClose,
    onArrowLeft: handlePrev,
    onArrowRight: handleNext,
    onKeyR: handleRotate,
    onKeyF: () => setViewMode(viewMode === 'fit' ? 'free' : 'fit'),
    onKey1: () => setViewMode('actual'),
    onPlus: () => setScale(prev => Math.min(prev + 10, 400)),
    onMinus: () => setScale(prev => Math.max(prev - 10, 25)),
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
            imageUrl={displayImageUrl}
            imageWidth={currentImage?.width || 0}
            imageHeight={currentImage?.height || 0}
            scale={scale}
            rotation={rotation}
            flipHorizontal={flipHorizontal}
            flipVertical={flipVertical}
            viewMode={viewMode}
            backgroundColor={backgroundColor}
            onScaleChange={setScale}
            onRotationChange={setRotation}
            onFlipChange={(h, v) => {
              setFlipHorizontal(h)
              setFlipVertical(v)
            }}
            onViewModeChange={setViewMode}
            isLoading={isLoading || isLoadingBlob}
            isError={isError}
            onRetry={retry}
          />
        </div>

{/* 右侧：信息面板 */}
        <div className="image-viewer-info-wrapper">
          <InfoPanel
            image={infoPanelImage}
            paletteImageUrl={displayImageUrl}
            paletteSourceLoading={isLoadingBlob}
            currentIndex={currentIndex}
            totalCount={images.length}
            rotation={rotation}
            flipHorizontal={flipHorizontal}
            flipVertical={flipVertical}
            backgroundColor={backgroundColor}
            onBackgroundColorChange={setBackgroundColor}
            onPrev={handlePrev}
            onNext={handleNext}
            onRotate={handleRotate}
            onFlipHorizontal={handleFlipHorizontal}
            onFlipVertical={handleFlipVertical}
            onReset={handleReset}
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

