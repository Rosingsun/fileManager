import React, { useState, useEffect, useCallback } from 'react'
import { Modal, Button, Spin, message, Empty, Typography, Space } from 'antd'
import { CheckCircleFilled } from '@ant-design/icons'
import type { Image } from '../ImageViewer/types'

const { Text } = Typography

interface CategoryImageSelectorProps {
  visible: boolean
  images: Image[]
  categoryLabel: string
  onClose: () => void
  onConfirm: (image: Image) => void
}

const CategoryImageSelector: React.FC<CategoryImageSelectorProps> = ({
  visible,
  images,
  categoryLabel,
  onClose,
  onConfirm
}) => {
  const [selectedImage, setSelectedImage] = useState<Image | null>(null)
  const [loadingThumbnails, setLoadingThumbnails] = useState<Record<string, string>>({})

  // 加载缩略图
  useEffect(() => {
    if (!visible || images.length === 0) return

    const loadThumbnails = async () => {
      setLoadingThumbnails({})

      for (const image of images) {
        if (loadingThumbnails[image.id]) continue

        try {
          // 尝试从缓存获取缩略图
          const cachedThumb = localStorage.getItem(`thumbnail_${image.id}`)
          if (cachedThumb) {
            setLoadingThumbnails(prev => ({ ...prev, [image.id]: cachedThumb }))
            continue
          }

          // 如果是 file:// URL，尝试获取缩略图
          if (image.url.startsWith('file://')) {
            const filePath = image.url.replace('file://', '')
            if (window.electronAPI?.getImageThumbnail) {
              const thumb = await window.electronAPI.getImageThumbnail(filePath, 400, 80)
              if (thumb) {
                // 缓存缩略图
                try {
                  localStorage.setItem(`thumbnail_${image.id}`, thumb)
                } catch (e) {
                  // 忽略缓存错误
                }
                setLoadingThumbnails(prev => ({ ...prev, [image.id]: thumb }))
              }
            }
          }
        } catch (error) {
          console.warn('加载缩略图失败:', image.id, error)
        }
      }
    }

    loadThumbnails()
  }, [visible, images])

  // 关闭时重置选择
  useEffect(() => {
    if (!visible) {
      setSelectedImage(null)
    }
  }, [visible])

  const handleConfirm = useCallback(() => {
    if (selectedImage) {
      onConfirm(selectedImage)
      onClose()
    } else {
      message.warning('请先选择一张图片')
    }
  }, [selectedImage, onConfirm, onClose])

  const handleImageClick = useCallback((image: Image) => {
    setSelectedImage(prev => prev?.id === image.id ? null : image)
  }, [])

  return (
    <Modal
      title={
        <Space>
          <span>选择图片</span>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
            ({categoryLabel} - 共 {images.length} 张)
          </Text>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary">
            {selectedImage ? (
              <>已选择: <Text strong>{selectedImage.filename}</Text></>
            ) : (
              '请点击图片进行选择'
            )}
          </Text>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              onClick={handleConfirm}
              disabled={!selectedImage}
            >
              确定打开大图
            </Button>
          </Space>
        </div>
      }
      destroyOnClose
      className="category-image-selector-modal"
    >
      {images.length === 0 ? (
        <Empty description="该分类下暂无图片" />
      ) : (
        <div className="category-image-selector-grid">
          {images.map(image => {
            const thumbnailUrl = loadingThumbnails[image.id]
            const isSelected = selectedImage?.id === image.id

            return (
              <div
                key={image.id}
                className={`category-image-selector-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleImageClick(image)}
              >
                <div className="category-image-selector-item-inner">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={image.filename}
                      className="category-image-selector-thumbnail"
                    />
                  ) : (
                    <div className="category-image-selector-loading">
                      <Spin size="small" />
                    </div>
                  )}
                  {isSelected && (
                    <div className="category-image-selector-check">
                      <CheckCircleFilled />
                    </div>
                  )}
                </div>
                <div className="category-image-selector-filename" title={image.filename}>
                  {image.filename}
                </div>
                {image.classification && (
                  <div className="category-image-selector-confidence">
                    置信度: {Math.round(image.classification.confidence * 100)}%
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export default CategoryImageSelector