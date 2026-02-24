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
            imageUrl={image.url} 
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

