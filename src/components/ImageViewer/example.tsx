/**
 * ImageViewer 使用示例
 * 
 * 这个文件展示了如何在项目中使用 ImageViewer 组件
 */

import React, { useState } from 'react'
import ImageViewer from './ImageViewer'
import type { Image } from './types'

// 示例：在 FileList 组件中使用
export function ImageViewerExample() {
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // 示例图片数据（实际使用时应该从文件系统或API获取）
  const images: Image[] = [
    {
      id: '1',
      url: 'data:image/jpeg;base64,...', // 或使用 window.electronAPI?.getImageBase64(path)
      filename: 'photo1.jpg',
      width: 1920,
      height: 1080,
      size: 1024000,
      format: 'jpeg',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      description: '示例图片1',
      tags: ['风景', '自然'],
      exif: {
        make: 'Canon',
        model: 'EOS 5D Mark IV',
        fNumber: 2.8,
        iso: 400,
        focalLength: 50,
        exposureTime: '1/125',
        dateTimeOriginal: new Date().toISOString()
      }
    },
    {
      id: '2',
      url: 'data:image/jpeg;base64,...',
      filename: 'photo2.jpg',
      width: 2560,
      height: 1440,
      size: 2048000,
      format: 'jpeg',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      description: '示例图片2',
      tags: ['人像'],
      exif: {
        make: 'Nikon',
        model: 'D850',
        fNumber: 1.8,
        iso: 200,
        focalLength: 85
      }
    }
  ]

  // 处理图片编辑
  const handleImageEdit = async (imageId: string, updates: any) => {
    console.log('编辑图片:', imageId, updates)
    // 这里可以调用后端API保存更改
    // await window.electronAPI?.updateImageMetadata(imageId, updates)
  }

  // 处理标签更新
  const handleTagsUpdate = async (imageId: string, tags: string[]) => {
    console.log('更新标签:', imageId, tags)
    // 这里可以调用后端API保存标签
    // await window.electronAPI?.updateImageTags(imageId, tags)
  }

  // 处理描述更新
  const handleDescriptionUpdate = async (imageId: string, description: string) => {
    console.log('更新描述:', imageId, description)
    // 这里可以调用后端API保存描述
    // await window.electronAPI?.updateImageDescription(imageId, description)
  }

  // 处理图片删除
  const handleImageDelete = async (imageId: string) => {
    console.log('删除图片:', imageId)
    // 这里可以调用后端API删除图片
    // await window.electronAPI?.deleteFile(imagePath)
  }

  // 处理图片旋转
  const handleImageRotate = async (imageId: string, rotation: number) => {
    console.log('旋转图片:', imageId, rotation)
    // 这里可以调用后端API旋转图片
    // await window.electronAPI?.rotateImage(imagePath, rotation)
  }

  // 处理图片翻转
  const handleImageFlip = async (imageId: string, direction: 'horizontal' | 'vertical') => {
    console.log('翻转图片:', imageId, direction)
    // 这里可以调用后端API翻转图片
    // await window.electronAPI?.flipImage(imagePath, direction)
  }

  return (
    <>
      {/* 触发按钮 */}
      <button onClick={() => setIsViewerOpen(true)}>
        打开图片查看器
      </button>

      {/* 图片查看器 */}
      {isViewerOpen && (
        <ImageViewer
          images={images}
          currentIndex={currentIndex}
          onIndexChange={setCurrentIndex}
          onClose={() => setIsViewerOpen(false)}
          onImageEdit={handleImageEdit}
          onTagsUpdate={handleTagsUpdate}
          onDescriptionUpdate={handleDescriptionUpdate}
          onImageDelete={handleImageDelete}
          onImageRotate={handleImageRotate}
          onImageFlip={handleImageFlip}
        />
      )}
    </>
  )
}

// 示例：从 FileList 组件中打开图片查看器
export function useImageViewerWithFileList() {
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [images, setImages] = useState<Image[]>([])

  // 从文件列表打开图片查看器
  const openImageViewer = async (filePath: string, fileList: any[], index: number) => {
    // 将文件列表转换为 Image 格式
    const imageList: Image[] = await Promise.all(
      fileList
        .filter(file => {
          const ext = file.name.split('.').pop()?.toLowerCase()
          return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '')
        })
        .map(async (file) => {
          // 获取图片base64数据
          const base64 = await window.electronAPI?.getImageBase64(file.path) || ''
          
          // 获取图片尺寸（需要从图片元数据中读取）
          const img = new Image()
          img.src = base64
          await new Promise((resolve) => {
            img.onload = resolve
          })

          return {
            id: file.path,
            url: base64,
            filename: file.name,
            width: img.width,
            height: img.height,
            size: file.size,
            format: file.name.split('.').pop() || 'unknown',
            createdAt: new Date(file.createdTime).toISOString(),
            modifiedAt: new Date(file.modifiedTime).toISOString(),
            description: '',
            tags: [],
            exif: undefined // 需要从后端获取EXIF数据
          }
        })
    )

    setImages(imageList)
    setCurrentIndex(index)
    setIsViewerOpen(true)
  }

  return {
    isViewerOpen,
    currentIndex,
    images,
    openImageViewer,
    closeImageViewer: () => setIsViewerOpen(false),
    setCurrentIndex
  }
}

