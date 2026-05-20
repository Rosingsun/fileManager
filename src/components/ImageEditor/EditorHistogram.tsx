import React, { useEffect, useRef } from 'react'
import type { LuminanceHistogramResult } from '../../utils'

interface EditorHistogramProps {
  histogram: LuminanceHistogramResult
  loading?: boolean
  className?: string
  height?: number
}

const EditorHistogram: React.FC<EditorHistogramProps> = ({
  histogram,
  loading = false,
  className = '',
  height = 48,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    ctx.fillStyle = grid
    ctx.globalAlpha = 0.35
    for (let i = 1; i < 4; i++) {
      const x = (w * i) / 4
      ctx.fillRect(x, 0, 1, h)
    }
    ctx.globalAlpha = 1

    const { bins, peak, clipShadow, clipHighlight } = histogram
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
    ctx.globalAlpha = 0.38
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = fill
    ctx.globalAlpha = 0.85
    ctx.lineWidth = 1 * dpr
    ctx.stroke()
    ctx.globalAlpha = 1

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
  }, [histogram, loading, height])

  return (
    <div
      className={`editor-histogram${loading ? ' is-loading' : ''}${className ? ` ${className}` : ''}`}
      style={{ height }}
      aria-hidden={histogram.total <= 0 && !loading}
    >
      <canvas ref={canvasRef} className="editor-histogram__canvas" />
    </div>
  )
}

export default EditorHistogram
