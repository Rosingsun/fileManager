import React, { useRef, useCallback } from 'react'
import { PictureOutlined } from '@ant-design/icons'
import type { ImageViewport } from './useSyncedImageViewport'
import { usePointerDragPan } from './useSyncedImageViewport'
import { Badge } from '../ui/badge'

export interface SyncedImagePaneProps {
  imageSrc: string | null
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  viewport: ImageViewport
  onWheel: (e: React.WheelEvent, container: HTMLElement) => void
  onPanBy: (dx: number, dy: number) => void
  onPick: () => void
  side: 'left' | 'right'
  title: string
  meta?: string
  badge?: 'keep' | 'delete' | 'rec' | null
  className?: string
}

const SyncedImagePane: React.FC<SyncedImagePaneProps> = ({
  imageSrc,
  loading = false,
  error = false,
  onRetry,
  viewport,
  onWheel,
  onPanBy,
  onPick,
  side,
  title,
  meta,
  badge,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { onPointerDown, onPointerMove, onPointerUp, wasDrag, resetDragFlag } =
    usePointerDragPan(onPanBy)

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (containerRef.current) onWheel(e, containerRef.current)
    },
    [onWheel]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (wasDrag()) {
        resetDragFlag()
        return
      }
      if (!imageSrc || loading || error) return
      onPick()
    },
    [wasDrag, resetDragFlag, imageSrc, loading, error, onPick]
  )

  const scaleFactor = viewport.scale / 100
  const transform = `translate(calc(-50% + ${viewport.pan.x}px), calc(-50% + ${viewport.pan.y}px)) scale(${scaleFactor})`
  const showLoading = loading || (!imageSrc && !error)

  return (
    <div
      className={`sim-compare-pane sim-compare-pane--${side} ${className}`.trim()}
      onClick={handleClick}
    >
      <div
        ref={containerRef}
        className="sim-compare-pane__stage"
        onWheel={handleWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        tabIndex={0}
        aria-label={side === 'left' ? '保留左侧照片' : '保留右侧照片'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (imageSrc && !loading && !error) onPick()
          }
        }}
      >
        {showLoading ? (
          <div className="sim-compare-pane__loading" aria-busy="true" aria-live="polite">
            <div className="sim-compare-pane__loading-shimmer" aria-hidden />
            <div className="sim-compare-pane__loading-core">
              <div className="sim-compare-pane__spinner" />
              <span className="sim-compare-pane__loading-text">加载中…</span>
            </div>
          </div>
        ) : error ? (
          <div className="sim-compare-pane__ph">
            <PictureOutlined />
            <span>加载失败</span>
            {onRetry ? (
              <button type="button" className="sim-compare-pane__retry" onClick={onRetry}>
                重试
              </button>
            ) : null}
          </div>
        ) : imageSrc ? (
          <img
            className="sim-compare-pane__img"
            src={imageSrc}
            alt=""
            draggable={false}
            style={{ transform }}
          />
        ) : (
          <div className="sim-compare-pane__ph">
            <PictureOutlined />
          </div>
        )}
        {badge ? (
          <div className="sim-compare-pane__badges">
            {badge === 'rec' ? (
              <Badge variant="default" className="sim-strip__badge sim-strip__badge--rec">
                推荐
              </Badge>
            ) : badge === 'delete' ? (
              <Badge variant="destructive" className="sim-strip__badge">
                将删除
              </Badge>
            ) : badge === 'keep' ? (
              <Badge variant="outline" className="sim-strip__badge sim-compare-pane__badge-keep">
                保留
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      <footer className="sim-compare-pane__foot">
        <span className="sim-compare-pane__name" title={title}>
          {title}
        </span>
        {meta ? <span className="sim-compare-pane__meta">{meta}</span> : null}
      </footer>
    </div>
  )
}

export default SyncedImagePane
