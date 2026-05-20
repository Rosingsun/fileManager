import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { LuminanceHistogramResult } from '../../utils'

interface EditorHistogramProps {
  histogram: LuminanceHistogramResult
  loading?: boolean
  className?: string
  height?: number
  /** 色阶黑/白点，启用后可拖拽 */
  levels?: { black: number; white: number }
  onLevelsChange?: (patch: { black?: number; white?: number }) => void
  showLevelHandles?: boolean
  /** RGB 直方图叠层 */
  showRgbOverlay?: boolean
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

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

  const clientXToLevel = useCallback(
    (clientX: number): number => {
      const wrap = wrapRef.current
      if (!wrap) return 0
      const rect = wrap.getBoundingClientRect()
      const t = (clientX - rect.left) / rect.width
      return clamp(Math.round(t * 255), 0, 255)
    },
    []
  )

  useEffect(() => {
    if (!dragTarget || !onLevelsChange) return
    const onMove = (e: MouseEvent) => {
      const v = clientXToLevel(e.clientX)
      if (dragTarget === 'black') {
        onLevelsChange({ black: clamp(v, 0, white - 1) })
      } else {
        onLevelsChange({ white: clamp(v, black + 1, 255) })
      }
    }
    const onUp = () => setDragTarget(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragTarget, onLevelsChange, clientXToLevel, black, white])

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

    ctx.fillStyle = grid
    ctx.globalAlpha = 0.35
    for (let i = 1; i < 4; i++) {
      const x = (w * i) / 4
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

    const pad = 2 * dpr
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
      ctx.lineWidth = 1.5 * dpr
      ctx.setLineDash([3 * dpr, 2 * dpr])
      ctx.beginPath()
      ctx.moveTo(bx, pad)
      ctx.lineTo(bx, h - pad)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(wx, pad)
      ctx.lineTo(wx, h - pad)
      ctx.stroke()
      ctx.setLineDash([])
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

  const blackPct = (black / 255) * 100
  const whitePct = (white / 255) * 100

  return (
    <div
      ref={wrapRef}
      className={`editor-histogram${loading ? ' is-loading' : ''}${showLevelHandles ? ' has-level-handles' : ''}${className ? ` ${className}` : ''}`}
      style={{ height }}
      aria-hidden={histogram.total <= 0 && !loading}
    >
      <canvas ref={canvasRef} className="editor-histogram__canvas" />
      {showLevelHandles && onLevelsChange && levels ? (
        <>
          <button
            type="button"
            className="editor-histogram__handle editor-histogram__handle--black"
            style={{ left: `${blackPct}%` }}
            aria-label="拖动调整黑点"
            onMouseDown={e => {
              e.preventDefault()
              setDragTarget('black')
            }}
          />
          <button
            type="button"
            className="editor-histogram__handle editor-histogram__handle--white"
            style={{ left: `${whitePct}%` }}
            aria-label="拖动调整白点"
            onMouseDown={e => {
              e.preventDefault()
              setDragTarget('white')
            }}
          />
        </>
      ) : null}
    </div>
  )
}

export default EditorHistogram
