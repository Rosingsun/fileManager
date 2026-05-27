import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { LuminanceHistogramResult } from '../../utils'
import {
  HISTOGRAM_INSET_PX,
  clampLevel,
  clientXToLevel,
  levelToLeftCss,
  pickLevelsHandle,
} from './editorLevelsLayout'

interface EditorHistogramProps {
  histogram: LuminanceHistogramResult
  loading?: boolean
  className?: string
  height?: number
  levels?: { black: number; white: number }
  onLevelsChange?: (patch: { black?: number; white?: number }) => void
  showLevelHandles?: boolean
  showRgbOverlay?: boolean
}

const EditorHistogram: React.FC<EditorHistogramProps> = ({
  histogram,
  loading = false,
  className = '',
  height = 48,
  levels,
  onLevelsChange,
  showLevelHandles = false,
  showRgbOverlay = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dragTarget, setDragTarget] = useState<'black' | 'white' | null>(null)

  const black = levels?.black ?? 0
  const white = levels?.white ?? 255
  const levelsActive = showLevelHandles && !!onLevelsChange && !!levels

  const applyLevelFromClientX = useCallback(
    (clientX: number, target: 'black' | 'white') => {
      const wrap = wrapRef.current
      if (!wrap || !onLevelsChange) return
      const rect = wrap.getBoundingClientRect()
      const v = clientXToLevel(clientX, rect)
      if (target === 'black') {
        onLevelsChange({ black: clampLevel(v, 0, white - 1) })
      } else {
        onLevelsChange({ white: clampLevel(v, black + 1, 255) })
      }
    },
    [onLevelsChange, black, white]
  )

  const startDrag = useCallback(
    (target: 'black' | 'white', clientX: number) => {
      setDragTarget(target)
      applyLevelFromClientX(clientX, target)
    },
    [applyLevelFromClientX]
  )

  useEffect(() => {
    if (!dragTarget) return
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX
      if (clientX == null) return
      applyLevelFromClientX(clientX, dragTarget)
    }
    const onUp = () => setDragTarget(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragTarget, applyLevelFromClientX])

  const handleWrapPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!levelsActive) return
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX
    if (clientX == null) return
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const picked = pickLevelsHandle(clientX, rect, black, white)
    if (picked) {
      e.preventDefault()
      startDrag(picked, clientX)
      return
    }
    const v = clientXToLevel(clientX, rect)
    if (Math.abs(v - black) <= Math.abs(v - white)) {
      e.preventDefault()
      onLevelsChange?.({ black: clampLevel(v, 0, white - 1) })
      startDrag('black', clientX)
    } else {
      e.preventDefault()
      onLevelsChange?.({ white: clampLevel(v, black + 1, 255) })
      startDrag('white', clientX)
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width * dpr))
    const h = Math.max(1, Math.floor(rect.height * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const style = getComputedStyle(canvas)
    const fill = style.getPropertyValue('--app-primary').trim() || '#007aff'
    const grid = style.getPropertyValue('--app-border').trim() || '#ccc'
    const warn = style.getPropertyValue('--app-warning').trim() || '#fa8c16'
    const red = '#ff3b30'
    const green = '#34c759'
    const blue = '#007aff'

    const pad = HISTOGRAM_INSET_PX * dpr

    ctx.fillStyle = grid
    ctx.globalAlpha = 0.35
    for (let i = 1; i < 4; i++) {
      const x = pad + ((w - pad * 2) * i) / 4
      ctx.fillRect(x, 0, 1, h)
    }
    ctx.globalAlpha = 1

    const { bins, peak, clipShadow, clipHighlight, rgbBins } = histogram
    if (histogram.total <= 0 || peak <= 0) {
      ctx.fillStyle = grid
      ctx.globalAlpha = 0.6
      ctx.font = `${11 * dpr}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(loading ? '…' : '无数据', w / 2, h / 2)
      ctx.globalAlpha = 1
      return
    }

    const chartH = h - pad * 2

    const drawChannel = (channelBins: Uint32Array, color: string, alpha: number) => {
      ctx.beginPath()
      for (let i = 0; i < 256; i++) {
        const x = pad + (i / 255) * (w - pad * 2)
        const barH = (channelBins[i] / peak) * chartH
        const y = h - pad - barH
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.lineTo(w - pad, h - pad)
      ctx.lineTo(pad, h - pad)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.globalAlpha = alpha
      ctx.fill()
      ctx.globalAlpha = 1
    }

    if (showRgbOverlay && rgbBins) {
      drawChannel(rgbBins.r, red, 0.22)
      drawChannel(rgbBins.g, green, 0.22)
      drawChannel(rgbBins.b, blue, 0.22)
    }

    ctx.beginPath()
    for (let i = 0; i < 256; i++) {
      const x = pad + (i / 255) * (w - pad * 2)
      const barH = (bins[i] / peak) * chartH
      const y = h - pad - barH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.lineTo(w - pad, h - pad)
    ctx.lineTo(pad, h - pad)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.globalAlpha = showRgbOverlay ? 0.28 : 0.38
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = fill
    ctx.globalAlpha = 0.85
    ctx.lineWidth = 1 * dpr
    ctx.stroke()
    ctx.globalAlpha = 1

    if (showLevelHandles && levels) {
      const bx = pad + (black / 255) * (w - pad * 2)
      const wx = pad + (white / 255) * (w - pad * 2)
      ctx.strokeStyle = warn
      ctx.globalAlpha = 0.9
      ctx.lineWidth = 2 * dpr
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(bx, pad)
      ctx.lineTo(bx, h - pad)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(wx, pad)
      ctx.lineTo(wx, h - pad)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    if (clipShadow > 0.02) {
      ctx.fillStyle = warn
      ctx.globalAlpha = 0.75
      ctx.fillRect(0, h - 3 * dpr, 4 * dpr, 3 * dpr)
      ctx.globalAlpha = 1
    }
    if (clipHighlight > 0.02) {
      ctx.fillStyle = warn
      ctx.globalAlpha = 0.75
      ctx.fillRect(w - 4 * dpr, h - 3 * dpr, 4 * dpr, 3 * dpr)
      ctx.globalAlpha = 1
    }
  }, [histogram, loading, height, showRgbOverlay, showLevelHandles, levels, black, white])

  const blackLeft = levelToLeftCss(black)
  const whiteLeft = levelToLeftCss(white)

  return (
    <div
      ref={wrapRef}
      className={`editor-histogram${loading ? ' is-loading' : ''}${levelsActive ? ' has-level-handles' : ''}${dragTarget ? ' is-dragging-levels' : ''}${className ? ` ${className}` : ''}`}
      style={{ height }}
      onMouseDown={levelsActive ? handleWrapPointerDown : undefined}
      onTouchStart={levelsActive ? handleWrapPointerDown : undefined}
      role={levelsActive ? 'group' : undefined}
      aria-label={levelsActive ? '直方图色阶：拖动黑场或白场手柄，或点击直方图调整' : undefined}
    >
      {levelsActive ? (
        <>
          <div
            className="editor-histogram__shade editor-histogram__shade--shadow"
            style={{ width: blackLeft }}
            aria-hidden
          />
          <div
            className="editor-histogram__shade editor-histogram__shade--highlight"
            style={{ left: whiteLeft, right: 0 }}
            aria-hidden
          />
        </>
      ) : null}
      <canvas ref={canvasRef} className="editor-histogram__canvas" />
      {levelsActive ? (
        <>
          <button
            type="button"
            className="editor-histogram__handle editor-histogram__handle--black"
            style={{ left: blackLeft }}
            aria-label={`黑场 ${black}，拖动调整`}
            aria-valuenow={black}
            aria-valuemin={0}
            aria-valuemax={white - 1}
            onMouseDown={e => {
              e.stopPropagation()
              e.preventDefault()
              startDrag('black', e.clientX)
            }}
            onTouchStart={e => {
              e.stopPropagation()
              const x = e.touches[0]?.clientX
              if (x != null) startDrag('black', x)
            }}
          >
            <span className="editor-histogram__handle-line" aria-hidden />
            <span className="editor-histogram__handle-knob">黑</span>
          </button>
          <button
            type="button"
            className="editor-histogram__handle editor-histogram__handle--white"
            style={{ left: whiteLeft }}
            aria-label={`白场 ${white}，拖动调整`}
            aria-valuenow={white}
            aria-valuemin={black + 1}
            aria-valuemax={255}
            onMouseDown={e => {
              e.stopPropagation()
              e.preventDefault()
              startDrag('white', e.clientX)
            }}
            onTouchStart={e => {
              e.stopPropagation()
              const x = e.touches[0]?.clientX
              if (x != null) startDrag('white', x)
            }}
          >
            <span className="editor-histogram__handle-line" aria-hidden />
            <span className="editor-histogram__handle-knob">白</span>
          </button>
        </>
      ) : null}
      {levelsActive ? (
        <div className="editor-histogram__scale" aria-hidden>
          <span>0</span>
          <span>128</span>
          <span>255</span>
        </div>
      ) : null}
    </div>
  )
}

export default EditorHistogram
