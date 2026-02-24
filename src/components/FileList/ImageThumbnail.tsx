import React from 'react'
import { PictureOutlined } from '@ant-design/icons'
import CircularProgress from '../CircularProgress'
import type { PreviewData } from './types'

interface ImageThumbnailProps {
  filePath: string
  fileName: string
  size: number
  maxSize: number
  previewData?: PreviewData
  isLoading: boolean
  progress?: number
  onClick?: () => void
  onRef?: (el: HTMLDivElement | null) => void
}

export const ImageThumbnail: React.FC<ImageThumbnailProps> = ({
  filePath,
  size,
  maxSize,
  previewData,
  isLoading,
  progress,
  onClick,
  onRef
}) => {
  const isLargeImage = size > maxSize

  const handleRef = (el: HTMLDivElement | null) => {
    if (onRef) {
      onRef(el)
    }
  }

  if (isLargeImage) {
    return (
      <div
        ref={handleRef}
        data-file-path={filePath}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          color: '#999',
          textAlign: 'center',
          padding: '4px'
        }}
        onClick={onClick}
      >
        <div>大图片</div>
        <div style={{ fontSize: '10px' }}>超过50MB</div>
      </div>
    )
  }

  if (previewData && (previewData.thumbnail || previewData.full)) {
    return (
      <img
        ref={handleRef}
        data-file-path={filePath}
        src={previewData.thumbnail || previewData.full}
        alt="preview"
        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
        onClick={onClick}
      />
    )
  }

  if (isLoading && progress !== undefined) {
    return (
      <div
        ref={handleRef}
        data-file-path={filePath}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={onClick}
      >
        <CircularProgress
          progress={progress}
          size={40}
          strokeWidth={3}
          color="#1890ff"
          backgroundColor="#e8e8e8"
          showText={true}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        ref={handleRef}
        data-file-path={filePath}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={onClick}
      >
        <PictureOutlined style={{ color: '#ccc' }} />
      </div>
    )
  }

  return (
    <div
      ref={handleRef}
      data-file-path={filePath}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClick}
    >
      <PictureOutlined style={{ color: '#ccc' }} />
    </div>
  )
}
