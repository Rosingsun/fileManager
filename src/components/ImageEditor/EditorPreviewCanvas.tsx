import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Button, Spin, Tooltip, Segmented } from 'antd'
import {
  TbZoomIn,
  TbZoomOut,
  TbZoomScan,
  TbArrowsMaximize,
  TbColumns2,
  TbEye,
} from '../icons'
import CropOverlay from './CropOverlay'
import { getFilterCss, getTransformCss, hasAnyEdit } from '../../utils'
import type { ImageEditSettings } from '../../types'

type PreviewViewMode = 'single' | 'wipe'

interface EditorPreviewCanvasProps {
  imageUrl: string | null
  originalUrl?: string | null
  sharpPreviewUrl?: string | null
  /** 对比视图全画幅预览（不含裁切），有裁切时由主进程生成 */
  sharpCompareUrl?: string | null
  sharpPreviewLoading?: boolean
  settings: ImageEditSettings
  onSettingsChange: (updates: Partial<ImageEditSettings>) => void
  imageWidth: number
  imageHeight: number
  showCropOverlay?: boolean
  loading?: boolean
  editCount?: number
  pickWhiteBalanceMode?: boolean
  onPickWhiteBalance?: (rgb: { r: number; g: number; b: number }) => void
}

const MIN_SCALE = 25
const MAX_SCALE = 400
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

const EditorPreviewCanvas: React.FC<EditorPreviewCanvasProps> = ({
  imageUrl,
  originalUrl,
  sharpPreviewUrl,
  sharpCompareUrl,
  sharpPreviewLoading,
  settings,
  onSettingsChange,
  imageWidth,
  imageHeight,
  showCropOverlay = false,
  loading = false,
  editCount = 0,
  pickWhiteBalanceMode = false,
  onPickWhiteBalance,
}) => {
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(100)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [holdOriginal, setHoldOriginal] = useState(false)
  const [viewMode, setViewMode] = useState<PreviewViewMode>('single')
  const [wipePos, setWipePos] = useState(50)
  const [isWipeDragging, setIsWipeDragging] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [stageFit, setStageFit] = useState({ width: 0, height: 0 })

  const pristineSrc = originalUrl || imageUrl
  const showSharpEdited = !!sharpPreviewUrl && !holdOriginal
  const showCssFallback = !holdOriginal && !showSharpEdited && hasAnyEdit(settings)
  const editedSrc = showSharpEdited ? sharpPreviewUrl : imageUrl
  const editedFilter = showCssFallback ? getFilterCss(settings) : 'none'
  const editedTransform = showCssFallback ? getTransformCss(settings) : 'none'

  const canCompare = hasAnyEdit(settings) && !!pristineSrc && !!editedSrc
  const useWipe = viewMode === 'wipe' && canCompare && !holdOriginal

  const compareEditedSrc =
    useWipe && sharpCompareUrl
      ? sharpCompareUrl
      : useWipe && settings.crop && imageUrl
        ? imageUrl
        : editedSrc
  const compareEditedFilter =
    useWipe && compareEditedSrc === imageUrl && hasAnyEdit(settings) ? editedFilter : 'none'
  const compareEditedTransform =
    useWipe && compareEditedSrc === imageUrl && hasAnyEdit(settings) ? editedTransform : 'none'

  const displaySrc = holdOriginal
    ? pristineSrc
    : useWipe
      ? null
      : editedSrc

  const cssFilter = holdOriginal || useWipe || showSharpEdited ? 'none' : editedFilter
  const cssTransform = holdOriginal || useWipe || showSharpEdited ? 'none' : editedTransform

  const renderW = imageWidth > 0 ? imageWidth : displaySize.width
  const renderH = imageHeight > 0 ? imageHeight : displaySize.height
  const layoutW = useWipe && stageFit.width > 0 ? stageFit.width : renderW
  const layoutH = useWipe && stageFit.height > 0 ? stageFit.height : renderH

  const recomputeStageFit = useCallback(() => {
    const stage = stageRef.current
    if (!stage || imageWidth <= 0 || imageHeight <= 0) return
    const rect = stage.getBoundingClientRect()
    const pad = 48
    const ratio = Math.min((rect.width - pad) / imageWidth, (rect.height - pad) / imageHeight)
    setStageFit({
      width: Math.max(1, Math.round(imageWidth * ratio)),
      height: Math.max(1, Math.round(imageHeight * ratio)),
    })
  }, [imageWidth, imageHeight])

  const fitToStage = useCallback(() => {
    const stage = stageRef.current
    if (!stage || imageWidth <= 0 || imageHeight <= 0) return
    const rect = stage.getBoundingClientRect()
    const pad = 48
    const fitScale = Math.min((rect.width - pad) / imageWidth, (rect.height - pad) / imageHeight) * 100
    setScale(clamp(Math.floor(fitScale), MIN_SCALE, MAX_SCALE))
    setPan({ x: 0, y: 0 })
    recomputeStageFit()
  }, [imageWidth, imageHeight, recomputeStageFit])

  useEffect(() => {
    if (imageUrl && imageWidth > 0) fitToStage()
  }, [imageUrl, imageWidth, imageHeight, fitToStage])

  useEffect(() => {
    const onResize = () => {
      recomputeStageFit()
      if (viewMode === 'wipe') {
        setScale(100)
        setPan({ x: 0, y: 0 })
      } else {
        fitToStage()
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fitToStage, recomputeStageFit, viewMode])

  useEffect(() => {
    if (imageWidth <= 0) return
    if (viewMode === 'wipe') {
      recomputeStageFit()
      setScale(100)
      setPan({ x: 0, y: 0 })
    } else {
      fitToStage()
    }
  }, [viewMode, imageWidth, imageHeight, recomputeStageFit, fitToStage])

  useEffect(() => {
    if (!canCompare && viewMode === 'wipe') setViewMode('single')
  }, [canCompare, viewMode])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isWipeDragging) {
        e.preventDefault()
        setHoldOriginal(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setHoldOriginal(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [isWipeDragging])

  const updateWipeFromClientX = useCallback((clientX: number) => {
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    if (rect.width <= 0) return
    const pct = ((clientX - rect.left) / rect.width) * 100
    setWipePos(clamp(Math.round(pct), 2, 98))
  }, [])

  useEffect(() => {
    if (!isWipeDragging) return
    const onMove = (e: MouseEvent) => updateWipeFromClientX(e.clientX)
    const onUp = () => setIsWipeDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isWipeDragging, updateWipeFromClientX])

  const handleWheel = (e: React.WheelEvent) => {
    if (isWipeDragging) return
    e.preventDefault()
    setScale(s => clamp(s + (e.deltaY > 0 ? -10 : 10), MIN_SCALE, MAX_SCALE))
  }

  const handleStageMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isWipeDragging) return
    setIsPanning(true)
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }

  const handleStageMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    })
  }

  const samplePixelFromImage = (img: HTMLImageElement, clientX: number, clientY: number) => {
    const rect = img.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0 || img.naturalWidth <= 0) return null
    const scaleX = img.naturalWidth / rect.width
    const scaleY = img.naturalHeight / rect.height
    const x = Math.min(img.naturalWidth - 1, Math.max(0, Math.floor((clientX - rect.left) * scaleX)))
    const y = Math.min(img.naturalHeight - 1, Math.max(0, Math.floor((clientY - rect.top) * scaleY)))
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    try {
      ctx.drawImage(img, x, y, 1, 1, 0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return { r: d[0], g: d[1], b: d[2] }
    } catch {
      return null
    }
  }

  const handlePickClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!pickWhiteBalanceMode || !onPickWhiteBalance) return
    e.stopPropagation()
    const rgb = samplePixelFromImage(e.currentTarget, e.clientX, e.clientY)
    if (rgb) onPickWhiteBalance(rgb)
  }

  const renderImageContent = () => {
    if (useWipe && pristineSrc && compareEditedSrc) {
      return (
        <div
          ref={frameRef}
          className="editor-compare-frame"
          style={{ width: layoutW, height: layoutH }}
        >
          <img
            className={`editor-compare-frame__img editor-compare-frame__img--base${pickWhiteBalanceMode ? ' is-wb-pick' : ''}`}
            src={pristineSrc}
            alt="原图"
            draggable={false}
            onClick={handlePickClick}
            onLoad={e => {
              const img = e.currentTarget
              setDisplaySize({ width: img.naturalWidth, height: img.naturalHeight })
            }}
          />
          <div
            className="editor-compare-frame__edited-wrap"
            style={{ clipPath: `inset(0 ${100 - wipePos}% 0 0)` }}
          >
            <img
              className={`editor-compare-frame__img editor-compare-frame__img--edited${pickWhiteBalanceMode ? ' is-wb-pick' : ''}`}
              src={compareEditedSrc}
              alt="效果"
              draggable={false}
              onClick={handlePickClick}
              style={{
                filter: compareEditedFilter,
                transform: compareEditedTransform,
              }}
            />
          </div>
          <div
            className="editor-compare-frame__region-veil editor-compare-frame__region-veil--effect"
            style={{ clipPath: `inset(0 ${100 - wipePos}% 0 0)` }}
            aria-hidden
          />
          <div
            className="editor-compare-frame__region-veil editor-compare-frame__region-veil--original"
            style={{ clipPath: `inset(0 0 0 ${wipePos}%)` }}
            aria-hidden
          />
          <div
            className="editor-compare-frame__divider"
            style={{ left: `${wipePos}%` }}
            onMouseDown={e => {
              e.stopPropagation()
              setIsWipeDragging(true)
              updateWipeFromClientX(e.clientX)
            }}
            role="slider"
            aria-label="拖动对比原图与效果"
            aria-valuenow={wipePos}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="editor-compare-frame__handle" />
          </div>
          <span className="editor-compare-frame__badge editor-compare-frame__badge--effect">效果</span>
          <span className="editor-compare-frame__badge editor-compare-frame__badge--original">原图</span>
        </div>
      )
    }

    if (displaySrc) {
      return (
        <div ref={frameRef} className="image-editor-preview-frame" style={{ width: renderW, height: renderH }}>
          <img
            src={displaySrc}
            alt="preview"
            draggable={false}
            className={pickWhiteBalanceMode ? 'is-wb-pick' : undefined}
            onClick={handlePickClick}
            onLoad={e => {
              const img = e.currentTarget
              setDisplaySize({ width: img.naturalWidth, height: img.naturalHeight })
            }}
            style={{
              width: renderW || 'auto',
              height: renderH || 'auto',
              filter: cssFilter,
              transform: cssTransform,
              cursor: pickWhiteBalanceMode ? 'crosshair' : undefined,
            }}
          />
          {showCropOverlay && imageWidth > 0 && !holdOriginal && (
            <CropOverlay
              settings={settings}
              onChange={onSettingsChange}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
            />
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div className="image-editor-canvas-wrap image-editor-root">
      <div className="image-editor-preview-toolbar">
        <div className="image-editor-preview-toolbar__group">
          <Tooltip title="适应窗口">
            <Button type="text" size="small" icon={<TbArrowsMaximize size={17} />} onClick={fitToStage} />
          </Tooltip>
          <Tooltip title="100%">
            <Button
              type="text"
              size="small"
              icon={<TbZoomScan size={17} />}
              onClick={() => {
                setScale(100)
                setPan({ x: 0, y: 0 })
              }}
            />
          </Tooltip>
          <span className="image-editor-preview-toolbar__divider" />
          <Button
            type="text"
            size="small"
            icon={<TbZoomOut size={17} />}
            onClick={() => setScale(s => clamp(s - 15, MIN_SCALE, MAX_SCALE))}
          />
          <span className="image-editor-preview-toolbar__zoom">{scale}%</span>
          <Button
            type="text"
            size="small"
            icon={<TbZoomIn size={17} />}
            onClick={() => setScale(s => clamp(s + 15, MIN_SCALE, MAX_SCALE))}
          />
        </div>

        <div className="image-editor-preview-toolbar__group">
          <Segmented
            size="small"
            value={viewMode}
            onChange={v => setViewMode(v as PreviewViewMode)}
            options={[
              { label: '效果', value: 'single' },
              {
                label: '对比',
                value: 'wipe',
                disabled: !canCompare,
              },
            ]}
          />
          <Button
            type={holdOriginal ? 'primary' : 'text'}
            size="small"
            icon={<TbEye size={17} />}
            onMouseDown={() => setHoldOriginal(true)}
            onMouseUp={() => setHoldOriginal(false)}
            onMouseLeave={() => setHoldOriginal(false)}
          >
            {holdOriginal ? '原图' : '按住原图'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="image-editor-loading">
          <Spin size="large" />
          <span>加载图片中…</span>
        </div>
      ) : !imageUrl ? (
        <div className="image-editor-empty">无法加载图片</div>
      ) : (
        <div
          ref={stageRef}
          className={`image-editor-preview-stage${isPanning ? ' is-dragging' : ''}${useWipe ? ' is-compare' : ''}${pickWhiteBalanceMode ? ' is-wb-pick-mode' : ''}`}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
        >
          <div
            className="image-editor-preview-inner"
            style={{
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale / 100})`,
            }}
          >
            {renderImageContent()}
          </div>
          {sharpPreviewLoading && (
            <div className="image-editor-preview-loading">
              <Spin size="small" /> 渲染预览…
            </div>
          )}
        </div>
      )}

      <footer className="image-editor-preview-status">
        <span>
          {imageWidth > 0 ? `${imageWidth} × ${imageHeight} px` : '—'}
        </span>
        <span className="image-editor-preview-status__sep">·</span>
        <span>{scale}%</span>
        {editCount > 0 ? (
          <>
            <span className="image-editor-preview-status__sep">·</span>
            <span className="image-editor-preview-status__edits">{editCount} 项调整</span>
          </>
        ) : (
          <>
            <span className="image-editor-preview-status__sep">·</span>
            <span>未调整</span>
          </>
        )}
        {useWipe ? (
          <>
            <span className="image-editor-preview-status__sep">·</span>
            <span>拖动中线对比</span>
          </>
        ) : null}
      </footer>
    </div>
  )
}

export default EditorPreviewCanvas
