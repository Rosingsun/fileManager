import React from 'react'
import { useLocalImageThumbnail } from '../../hooks'

export interface LocalFileImagePreviewProps {
  filePath: string
  alt?: string
  style?: React.CSSProperties
  maxEdge?: number
  quality?: number
}

const LocalFileImagePreview: React.FC<LocalFileImagePreviewProps> = ({
  filePath,
  alt = '',
  style,
  maxEdge = 240,
  quality = 75
}) => {
  const { src, loading } = useLocalImageThumbnail(filePath, { maxEdge, quality })

  if (!src) {
    return (
      <div
        style={{
          ...style,
          background: '#f0f0f0',
          flexShrink: 0
        }}
        aria-busy={loading}
        aria-label={loading ? '加载预览' : undefined}
      />
    )
  }

  return <img src={src} alt={alt} style={{ ...style, flexShrink: 0 }} />
}

export default LocalFileImagePreview
