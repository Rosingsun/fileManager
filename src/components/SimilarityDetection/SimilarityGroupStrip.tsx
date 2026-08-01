import React from 'react'
import { Checkbox } from '../ui/checkbox'
import { PictureOutlined } from '@ant-design/icons'
import type { SimilarityGroup } from '../../types'
import { Badge } from '../ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { basename } from './similarityShared'
import { formatFileSize } from '../../utils'

interface SimilarityGroupStripProps {
  group: SimilarityGroup
  keepSet: Set<string>
  thumbnails: Map<string, string>
  loadingPaths: Set<string>
  onToggleKeep: (imagePath: string) => void
  onPreview: (imagePath: string) => void
  onCompare?: () => void
}

const SimilarityGroupStrip: React.FC<SimilarityGroupStripProps> = ({
  group,
  keepSet,
  thumbnails,
  loadingPaths,
  onToggleKeep,
  onPreview,
  onCompare,
}) => {
  return (
    <div className="sim-strip">
      {group.images.map((img) => {
        const isKept = keepSet.has(img.filePath)
        const isRecommended = img.filePath === group.recommendedKeep
        const thumb = thumbnails.get(img.filePath)

        return (
          <article
            key={img.filePath}
            className={`sim-strip__card ${isKept ? 'is-kept' : 'is-delete'} ${isRecommended ? 'is-rec' : ''}`}
          >
            <div
              className="sim-strip__photo"
              onClick={() => onPreview(img.filePath)}
              onDoubleClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onCompare?.()
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPreview(img.filePath)
                }
              }}
            >
              {thumb ? (
                <img src={thumb} alt="" />
              ) : (
                <div className="sim-strip__ph">
                  {loadingPaths.has(img.filePath) ? (
                    <div className="sim-spinner" />
                  ) : (
                    <PictureOutlined />
                  )}
                </div>
              )}
              <div className="sim-strip__overlay">
                <div className="sim-strip__overlay-top">
                  <label className="sim-strip__check" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isKept}
                      onCheckedChange={() => onToggleKeep(img.filePath)}
                    />
                  </label>
                  {isRecommended ? (
                    <Badge variant="default" className="sim-strip__badge sim-strip__badge--rec">
                      推荐
                    </Badge>
                  ) : !isKept ? (
                    <Badge variant="destructive" className="sim-strip__badge">
                      冗余
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <footer className="sim-strip__foot">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="sim-strip__name">{basename(img.filePath)}</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[min(90vw,320px)] break-all">
                  {img.filePath}
                </TooltipContent>
              </Tooltip>
              <span className="sim-strip__meta">{formatFileSize(img.size)}</span>
            </footer>
          </article>
        )
      })}
    </div>
  )
}

export default SimilarityGroupStrip
