import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Button, Segmented, Switch } from 'antd'
import { ControlRow, PanelSection } from './editorControlPrimitives'
import EditorHistogram from './EditorHistogram'
import {
  resetEditPanel,
  DEFAULT_LEVELS,
  DEFAULT_TONE_CURVE_POINTS,
  normalizeCurvePoints,
  computeAutoLevels,
  getCurvePointsForChannel,
} from '../../utils'
import { useImageHistogram } from '../../hooks'
import type { ImageEditSettings } from '../../types'
import type { ToneCurveChannelKey, ToneCurvePoint } from '../../utils'

const LEVELS_RAIL =
  'linear-gradient(90deg, #0a0a0a 0%, #808080 50%, #f5f5f5 100%)'

const CHART_SIZE = 200
const POINT_R = 6

const CHANNEL_OPTIONS: { label: string; value: ToneCurveChannelKey }[] = [
  { label: 'RGB', value: 'master' },
  { label: 'R', value: 'red' },
  { label: 'G', value: 'green' },
  { label: 'B', value: 'blue' },
]

const CHANNEL_STROKE: Record<ToneCurveChannelKey, string> = {
  master: 'var(--app-primary)',
  red: '#ff3b30',
  green: '#34c759',
  blue: '#007aff',
}

interface EditorCurvesPanelProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
  previewSrc: string | null
  settingsDigest: string
  filePath?: string
  imagePixelCount?: number
}

function getLevels(settings: ImageEditSettings) {
  return settings.levels ?? { ...DEFAULT_LEVELS }
}

const EditorCurvesPanel: React.FC<EditorCurvesPanelProps> = ({
  settings,
  onChange,
  previewSrc,
  settingsDigest,
  filePath,
  imagePixelCount,
}) => {
  const { histogram, loading: histLoading } = useImageHistogram(previewSrc, settingsDigest, {
    filePath,
    pixelCount: imagePixelCount,
  })
  const chartRef = useRef<SVGSVGElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [curveChannel, setCurveChannel] = useState<ToneCurveChannelKey>('master')
  const [showRgbHist, setShowRgbHist] = useState(false)

  const levels = getLevels(settings)
  const points = useMemo(
    () => getCurvePointsForChannel(settings.toneCurve, curveChannel),
    [settings.toneCurve, curveChannel]
  )

  const handleLevels = (key: 'black' | 'white' | 'gamma') => (value: number) => {
    onChange({ levels: { ...levels, [key]: value } })
  }

  const handleLevelsFromHist = (patch: { black?: number; white?: number }) => {
    onChange({ levels: { ...levels, ...patch } })
  }

  const setCurvePoints = useCallback(
    (next: ToneCurvePoint[]) => {
      const normalized = normalizeCurvePoints(next)
      const prev = settings.toneCurve ?? {}
      if (curveChannel === 'master') {
        onChange({ toneCurve: { ...prev, master: normalized } })
      } else {
        onChange({ toneCurve: { ...prev, [curveChannel]: normalized } })
      }
    },
    [onChange, settings.toneCurve, curveChannel]
  )

  const handleAutoLevels = () => {
    const auto = computeAutoLevels(histogram.bins)
    onChange({ levels: auto })
  }

  const clientToNorm = (clientX: number, clientY: number): ToneCurvePoint | null => {
    const svg = chartRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const x = (clientX - rect.left) / rect.width
    const y = 1 - (clientY - rect.top) / rect.height
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    }
  }

  const handlePointMouseDown = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragIndex(index)
  }

  const handleChartMouseMove = (e: React.MouseEvent) => {
    if (dragIndex == null) return
    const norm = clientToNorm(e.clientX, e.clientY)
    if (!norm) return
    const next = [...points]
    if (dragIndex === 0) {
      next[0] = { x: 0, y: norm.y }
    } else if (dragIndex === next.length - 1) {
      next[next.length - 1] = { x: 1, y: norm.y }
    } else {
      const prev = next[dragIndex - 1].x + 0.02
      const follow = next[dragIndex + 1].x - 0.02
      next[dragIndex] = {
        x: Math.min(follow, Math.max(prev, norm.x)),
        y: norm.y,
      }
    }
    setCurvePoints(next)
  }

  const handleChartMouseUp = () => setDragIndex(null)

  const handleChartDoubleClick = (e: React.MouseEvent) => {
    const norm = clientToNorm(e.clientX, e.clientY)
    if (!norm || norm.x <= 0.03 || norm.x >= 0.97) return
    if (points.length >= 7) return
    const next = [...points, norm].sort((a, b) => a.x - b.x)
    setCurvePoints(next)
  }

  const handlePointDoubleClick = (index: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (index === 0 || index === points.length - 1) return
    if (points.length <= 2) return
    setCurvePoints(points.filter((_, i) => i !== index))
  }

  const resetCurrentCurve = () => {
    const prev = settings.toneCurve ?? {}
    if (curveChannel === 'master') {
      const { master: _m, ...rest } = prev
      onChange({ toneCurve: Object.keys(rest).length ? rest : undefined })
    } else {
      const next = { ...prev }
      delete next[curveChannel]
      onChange({ toneCurve: Object.keys(next).length ? next : undefined })
    }
  }

  const pathD = useMemo(() => {
    const pts = points
    let d = `M 0 ${CHART_SIZE * (1 - pts[0].y)}`
    for (let i = 1; i < pts.length; i++) {
      const x = pts[i].x * CHART_SIZE
      const y = CHART_SIZE * (1 - pts[i].y)
      d += ` L ${x} ${y}`
    }
    return d
  }, [points])

  return (
    <div className="image-editor-controls-panel editor-panel-body">
      <PanelSection title="直方图" onReset={() => onChange(resetEditPanel('curves'))}>
        <EditorHistogram
          histogram={histogram}
          loading={histLoading}
          height={56}
          levels={levels}
          onLevelsChange={handleLevelsFromHist}
          showLevelHandles
          showRgbOverlay={showRgbHist}
        />
        <div className="editor-curves-auto-row">
          <Button size="small" type="default" onClick={handleAutoLevels} disabled={histogram.total <= 0}>
            自动色阶
          </Button>
          <label className="editor-curves-rgb-toggle">
            <span>RGB 叠层</span>
            <Switch size="small" checked={showRgbHist} onChange={setShowRgbHist} />
          </label>
        </div>
        <p className="editor-curves-hint">拖动直方图下沿三角可调整黑场/白场</p>
      </PanelSection>

      <PanelSection title="色阶">
        <ControlRow
          label="黑点"
          value={levels.black}
          defaultValue={DEFAULT_LEVELS.black}
          min={0}
          max={254}
          onChange={handleLevels('black')}
          railGradient={LEVELS_RAIL}
        />
        <ControlRow
          label="中间调"
          value={levels.gamma}
          defaultValue={DEFAULT_LEVELS.gamma}
          min={50}
          max={200}
          onChange={handleLevels('gamma')}
          unit="%"
        />
        <ControlRow
          label="白点"
          value={levels.white}
          defaultValue={DEFAULT_LEVELS.white}
          min={1}
          max={255}
          onChange={handleLevels('white')}
          railGradient={LEVELS_RAIL}
        />
      </PanelSection>

      <PanelSection title="曲线">
        <Segmented
          size="small"
          className="editor-curves-channel-nav"
          value={curveChannel}
          onChange={v => setCurveChannel(v as ToneCurveChannelKey)}
          options={CHANNEL_OPTIONS}
        />
        <p className="editor-curves-hint">拖动控制点；空白处双击添加；双击中间点可删除</p>
        <div className="editor-curves-chart-wrap">
          <svg
            ref={chartRef}
            className="editor-curves-chart"
            viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
            onMouseMove={handleChartMouseMove}
            onMouseUp={handleChartMouseUp}
            onMouseLeave={handleChartMouseUp}
            onDoubleClick={handleChartDoubleClick}
          >
            <defs>
              <linearGradient id="editor-curves-grid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--app-border)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--app-border)" stopOpacity="0.15" />
              </linearGradient>
            </defs>
            <rect width={CHART_SIZE} height={CHART_SIZE} fill="url(#editor-curves-grid)" rx="6" />
            {[0.25, 0.5, 0.75].map(t => (
              <g key={t}>
                <line
                  x1={t * CHART_SIZE}
                  y1={0}
                  x2={t * CHART_SIZE}
                  y2={CHART_SIZE}
                  className="editor-curves-chart__grid-line"
                />
                <line
                  x1={0}
                  y1={t * CHART_SIZE}
                  x2={CHART_SIZE}
                  y2={t * CHART_SIZE}
                  className="editor-curves-chart__grid-line"
                />
              </g>
            ))}
            <line x1={0} y1={CHART_SIZE} x2={CHART_SIZE} y2={0} className="editor-curves-chart__diag" />
            <path
              d={pathD}
              className="editor-curves-chart__path"
              fill="none"
              style={{ stroke: CHANNEL_STROKE[curveChannel] }}
            />
            {points.map((p, i) => (
              <circle
                key={`${curveChannel}-${i}-${p.x}-${p.y}`}
                cx={p.x * CHART_SIZE}
                cy={CHART_SIZE * (1 - p.y)}
                r={POINT_R}
                className={`editor-curves-point${dragIndex === i ? ' is-active' : ''}`}
                style={{ stroke: CHANNEL_STROKE[curveChannel] }}
                onMouseDown={handlePointMouseDown(i)}
                onDoubleClick={handlePointDoubleClick(i)}
              />
            ))}
          </svg>
        </div>
        <Button type="text" size="small" className="editor-curves-reset-curve" onClick={resetCurrentCurve}>
          重置当前通道曲线
        </Button>
      </PanelSection>
    </div>
  )
}

export default EditorCurvesPanel
