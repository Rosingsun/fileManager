/**
 * 信息面板组件（整合所有信息区域）
 */

import React from 'react'
import FileInfoSection from './FileInfoSection'
import ExifInfoSection from './ExifInfoSection'
import ColorPalette from './ColorPalette'
import DescriptionEditor from './DescriptionEditor'
import TagManager from './TagManager'
import Toolbar from './Toolbar'
import type { Image } from '../types'
import './InfoPanel.css'

export interface InfoPanelProps {
  image: Image | null
  /** 与画布一致的可采样 URL（如 data:/blob:），用于主色提取；勿传未转换的 file:// */
  paletteImageUrl?: string | null
  /** file:// 转 blob/base64 过程中为 true，避免误判为「无法提取」 */
  paletteSourceLoading?: boolean
  currentIndex: number
  totalCount: number
  rotation: number
  flipHorizontal: boolean
  flipVertical: boolean
  backgroundColor: string | null
  onBackgroundColorChange: (color: string | null) => void
  onDescriptionSave: (description: string) => void
  onTagsChange: (tags: string[]) => void
  onPrev: () => void
  onNext: () => void
  onRotate: () => void
  onFlipHorizontal: () => void
  onFlipVertical: () => void
  onReset: () => void
  onDelete?: () => void
  onDownload?: () => void
  onFavorite?: () => void
  tagSuggestions?: string[]
}

const InfoPanel: React.FC<InfoPanelProps> = ({
  image,
  paletteImageUrl,
  paletteSourceLoading,
  currentIndex,
  totalCount,
  rotation,
  flipHorizontal,
  flipVertical,
  backgroundColor,
  onBackgroundColorChange,
  onDescriptionSave,
  onTagsChange,
  onPrev,
  onNext,
  onRotate,
  onFlipHorizontal,
  onFlipVertical,
  onReset,
  onDelete,
  onDownload,
  onFavorite,
  tagSuggestions
}) => {
  if (!image) {
    return (
      <div className="info-panel">
        <div className="info-empty">请选择一张图片</div>
      </div>
    )
  }

  return (
    <div className="info-panel">
      <div className="info-panel-content">
        <FileInfoSection image={image} />
        <ExifInfoSection image={image} />
        <ColorPalette
            imageUrl={paletteImageUrl ?? image.url}
            sourceLoading={paletteSourceLoading}
            backgroundColor={backgroundColor}
            onBackgroundColorChange={onBackgroundColorChange}
          />
        <DescriptionEditor
          description={image.description || ''}
          onSave={onDescriptionSave}
          classification={image.classification}
        />
        <TagManager
          tags={image.tags || []}
          onTagsChange={onTagsChange}
          suggestions={tagSuggestions}
        />
        <Toolbar
          currentIndex={currentIndex}
          totalCount={totalCount}
          rotation={rotation}
          flipHorizontal={flipHorizontal}
          flipVertical={flipVertical}
          onPrev={onPrev}
          onNext={onNext}
          onRotate={onRotate}
          onFlipHorizontal={onFlipHorizontal}
          onFlipVertical={onFlipVertical}
          onReset={onReset}
          onDelete={onDelete}
          onDownload={onDownload}
          onFavorite={onFavorite}
        />
      </div>
    </div>
  )
}

export default InfoPanel

