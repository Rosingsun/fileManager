import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Button, Spin, Tooltip, Segmented } from 'antd'
import {
  TbZoomIn,
  TbZoomOut,
  TbZoomScan,
  TbArrowsMaximize,
  TbEye,
} from '../icons'
import CropOverlay from './CropOverlay'
import { getInstantFilterCss, getTransformCss, hasAnyEdit } from '../../utils'
import type { ImageEditSettings } from '../../types'

export type PreviewViewMode = 'single' | 'wipe'

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
  viewMode: PreviewViewMode
  onViewModeChange: (mode: PreviewViewMode) => void
}

const MIN_SCALE = 25
const MAX_SCALE = 400
const STAGE_PADDING = 48

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/** 焦点在可输入控件时，不劫持空格等快捷键 */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable
}

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
  viewMode,
  onViewModeChange,
}) => {
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(100)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [holdOriginal, setHoldOriginal] = useState(false)
  const [wipePos, setWipePos] = useState(50)
  const [isWipeDragging, setIsWipeDragging] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [stageFit, setStageFit] = useState({ width: 0, height: 0 })

  const pristineSrc = originalUrl || imageUrl
  const showSharpEdited = !!sharpPreviewUrl && !holdOriginal
  const editedSrc = showSharpEdited ? sharpPreviewUrl : imageUrl

  /** 基础项走 CSS 即时出画；Sharp 预览图层只负责高级项，二者不重叠 */
  const instantFilter = getInstantFilterCss(settings)
  const geometryTransform = getTransformCss(settings)
  const hasEdits = hasAnyEdit(settings)

  const canCompare = hasEdits && !!pristineSrc && !!editedSrc
  const useWipe = viewMode === 'wipe' && canCompare && !holdOriginal

  const compareEditedSrc =
    useWipe && sharpCompareUrl
      ? sharpCompareUrl
      : useWipe && settings.crop && imageUrl
        ? imageUrl
        : editedSrc

  /** 裁切结果已在预览图内时按裁切尺寸布局，避免被拉伸回原尺寸 */
  const croppedFrame =
    !!settings.crop && !!sharpPreviewUrl && !showCropOverlay && !useWipe
      ? settings.crop
      : null

  const baseW = croppedFrame ? croppedFrame.width : imageWidth > 0 ? imageWidth : displaySize.width
  const baseH = croppedFrame ? croppedFrame.height : imageHeight > 0 ? imageHeight : displaySize.height

  /**
   * 几何变换只在非裁切状态下生效：导出管线是「先裁切后旋转」，
   * 裁切遮罩必须贴在未旋转的画面上才能与坐标对齐。
   */
  const applyGeometry = !holdOriginal && !showCropOverlay
  const rotation = applyGeometry ? Math.abs((settings.rotation ?? 0) % 360) : 0
  const rad = (rotation * Math.PI) / 180
  const cosR = Math.abs(Math.cos(rad))
  const sinR = Math.abs(Math.sin(rad))
  /** 旋转后包围盒，避免 frame 的 overflow:hidden 把旋转后的画面裁掉 */
  const contentW = Math.round(baseW * cosR + baseH * sinR) || baseW
  const contentH = Math.round(baseW * sinR + baseH * cosR) || baseH
  const activeTransform = applyGeometry ? geometryTransform : 'none'

  const layoutW = useWipe && stageFit.width > 0 ? stageFit.width : contentW
  const layoutH = useWipe && stageFit.height > 0 ? stageFit.height : contentH

  const recomputeStageFit = useCallback(() => {
    const stage = stageRef.current
    if (!stage || contentW <= 0 || contentH <= 0) return
    const rect = stage.getBoundingClientRect()
    const ratio = Math.min(
      (rect.width - STAGE_PADDING) / contentW,
      (rect.height - STAGE_PADDING) / contentH
    )
    setStageFit({
      width: Math.max(1, Math.round(contentW * ratio)),
      height: Math.max(1, Math.round(contentH * ratio)),
    })
  }, [contentW, contentH])

  const fitToStage = useCallback(() => {
    const stage = stageRef.current
    if (!stage || contentW <= 0 || contentH <= 0) return
    const rect = stage.getBoundingClientRect()
    const fitScale =
      Math.min((rect.width - STAGE_PADDING) / contentW, (rect.height - STAGE_PADDING) / contentH) *
      100
    setScale(clamp(Math.floor(fitScale), MIN_SCALE, MAX_SCALE))
    setPan({ x: 0, y: 0 })
    recomputeStageFit()
  }, [contentW, contentH, recomputeStageFit])

  /** 只在「换图 / 裁切尺寸变化」时重新适应窗口，旋转等调整不打断用户的缩放 */
  const fitRef = useRef(fitToStage)
  fitRef.current = fitToStage

  useEffect(() => {
    if (imageUrl && baseW > 0) fitRef.current()
  }, [imageUrl, baseW, baseH])

  useEffect(() => {
    const onResize = () => {
      recomputeStageFit()
      fitRef.current()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [recomputeStageFit])

  useEffect(() => {
    if (baseW <= 0) return
    if (viewMode === 'wipe') {
      recomputeStageFit()
      setScale(100)
      setPan({ x: 0, y: 0 })
    } else {
      fitRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, baseW, baseH])

  useEffect(() => {
    if (!canCompare && viewMode === 'wipe') onViewModeChange('single')
  }, [canCompare, viewMode, onViewModeChange])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
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

  /** React 的 onWheel 是被动监听，preventDefault 无效，这里改用原生非被动监听 */
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (e: WheelEvent) => {
      if (isWipeDragging) return
      e.preventDefault()
      setScale(s => clamp(s + (e.deltaY > 0 ? -10 : 10), MIN_SCALE, MAX_SCALE))
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [isWipeDragging, imageUrl, loading])

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

  const handleStageMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isWipeDragging) return
    /** 取色模式下不拖动画布，避免误移动 */
    if (pickWhiteBalanceMode) return
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
            style={{ transform: activeTransform }}
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
                filter: instantFilter,
                transform: activeTransform,
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

    if (!imageUrl) return null

    const showSrc = holdOriginal ? pristineSrc : editedSrc
    if (!showSrc) return null

    return (
      <div
        ref={frameRef}
        className="image-editor-preview-frame"
        style={{ width: contentW, height: contentH }}
      >
        <img
          src={showSrc}
          alt="preview"
          draggable={false}
          className={pickWhiteBalanceMode ? 'is-wb-pick' : undefined}
          onClick={handlePickClick}
          onLoad={e => {
            const img = e.currentTarget
            setDisplaySize({ width: img.naturalWidth, height: img.naturalHeight })
          }}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: baseW || 'auto',
            height: baseH || 'auto',
            transform: `translate(-50%, -50%) ${activeTransform === 'none' ? '' : activeTransform}`.trim(),
            transformOrigin: 'center center',
            filter: holdOriginal ? 'none' : instantFilter,
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

  const previewPending = !!sharpPreviewLoading && !sharpPreviewUrl

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
          <Tooltip title="缩小">
            <Button
              type="text"
              size="small"
              icon={<TbZoomOut size={17} />}
              onClick={() => setScale(s => clamp(s - 15, MIN_SCALE, MAX_SCALE))}
            />
          </Tooltip>
          <span className="image-editor-preview-toolbar__zoom">{scale}%</span>
          <Tooltip title="放大">
            <Button
              type="text"
              size="small"
              icon={<TbZoomIn size={17} />}
              onClick={() => setScale(s => clamp(s + 15, MIN_SCALE, MAX_SCALE))}
            />
          </Tooltip>
        </div>

        <div className="image-editor-preview-toolbar__group">
          <Segmented
            size="small"
            value={viewMode}
            onChange={v => onViewModeChange(v as PreviewViewMode)}
            options={[
              { label: '效果', value: 'single' },
              {
                label: '对比',
                value: 'wipe',
                disabled: !canCompare,
              },
            ]}
          />
          <Tooltip title="按住查看原图（空格）">
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
          </Tooltip>
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
          {previewPending && (
            <div className="image-editor-preview-loading">
              <Spin size="small" /> 渲染预览…
            </div>
          )}
        </div>
      )}

      <footer className="image-editor-preview-status">
        <span>{imageWidth > 0 ? `${imageWidth} × ${imageHeight} px` : '—'}</span>
        {croppedFrame ? (
          <>
            <span className="image-editor-preview-status__sep">·</span>
            <span className="image-editor-preview-status__edits">
              裁切后 {Math.round(croppedFrame.width)} × {Math.round(croppedFrame.height)}
            </span>
          </>
        ) : null}
        <span className="image-editor-preview-status__sep">·</span>
        <span>{scale}%</span>
        <span className="image-editor-preview-status__sep">·</span>
        {editCount > 0 ? (
          <span className="image-editor-preview-status__edits">{editCount} 项调整</span>
        ) : (
          <span>未调整</span>
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
