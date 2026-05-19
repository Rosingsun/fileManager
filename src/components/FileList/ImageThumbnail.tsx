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
  showLiveBadge?: boolean
  showRawBadge?: boolean
  onClick?: () => void
  onRef?: (el: HTMLDivElement | null) => void
}

const ThumbnailBadges: React.FC<{ showLive?: boolean; showRaw?: boolean }> = ({
  showLive,
  showRaw
}) => {
  if (!showLive && !showRaw) return null
  return (
    <div className="file-thumbnail-badges">
      {showLive && <span className="file-thumbnail-badge file-thumbnail-badge--live">LIVE</span>}
      {showRaw && <span className="file-thumbnail-badge file-thumbnail-badge--raw">RAW</span>}
    </div>
  )
}

export const ImageThumbnail: React.FC<ImageThumbnailProps> = ({
  filePath,
  size,
  maxSize,
  previewData,
  isLoading,
  progress,
  showLiveBadge = false,
  showRawBadge = false,
  onClick,
  onRef
}) => {
  const isLargeImage = size > maxSize

  const handleRef = (el: HTMLDivElement | null) => {
    onRef?.(el)
  }

  const placeholderStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: '#999',
    textAlign: 'center',
    padding: '4px'
  }

  if (isLargeImage) {
    return (
      <div className="file-thumbnail-wrap">
        <div ref={handleRef} data-file-path={filePath} style={placeholderStyle} onClick={onClick}>
          <div>大图片</div>
          <div style={{ fontSize: '10px' }}>超过50MB</div>
        </div>
        <ThumbnailBadges showLive={showLiveBadge} showRaw={showRawBadge} />
      </div>
    )
  }

  if (previewData && (previewData.thumbnail || previewData.full)) {
    return (
      <div className="file-thumbnail-wrap">
        <img
          ref={handleRef as unknown as React.Ref<HTMLImageElement>}
          data-file-path={filePath}
          src={previewData.thumbnail || previewData.full}
          alt="preview"
          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
          onClick={onClick}
        />
        <ThumbnailBadges showLive={showLiveBadge} showRaw={showRawBadge} />
      </div>
    )
  }

  if (isLoading && progress !== undefined) {
    return (
      <div className="file-thumbnail-wrap">
        <div ref={handleRef} data-file-path={filePath} style={placeholderStyle} onClick={onClick}>
          <CircularProgress
            progress={progress}
            size={40}
            strokeWidth={3}
            color="var(--app-primary)"
            backgroundColor="#e8e8e8"
            showText={true}
          />
        </div>
        <ThumbnailBadges showLive={showLiveBadge} showRaw={showRawBadge} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="file-thumbnail-wrap">
        <div ref={handleRef} data-file-path={filePath} style={placeholderStyle} onClick={onClick}>
          <PictureOutlined style={{ color: '#ccc' }} />
        </div>
        <ThumbnailBadges showLive={showLiveBadge} showRaw={showRawBadge} />
      </div>
    )
  }

  return (
    <div className="file-thumbnail-wrap">
      <div ref={handleRef} data-file-path={filePath} style={placeholderStyle} onClick={onClick}>
        <PictureOutlined style={{ color: '#ccc' }} />
      </div>
      <ThumbnailBadges showLive={showLiveBadge} showRaw={showRawBadge} />
    </div>
  )
}
