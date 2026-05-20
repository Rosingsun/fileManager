import React from 'react'
import { Slider } from 'antd'
import EditorHistogram from './EditorHistogram'
import type { LuminanceHistogramResult } from '../../utils'

const HUE_RAIL =
  'linear-gradient(90deg, hsl(0,85%,52%) 0%, hsl(60,85%,52%) 17%, hsl(120,85%,52%) 33%, hsl(180,85%,52%) 50%, hsl(240,85%,52%) 67%, hsl(300,85%,52%) 83%, hsl(360,85%,52%) 100%)'

const EXPOSURE_RAIL =
  'linear-gradient(90deg, #1a1a1a 0%, #5a5a5a 35%, #c8c8c8 70%, #ffffff 100%)'

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

interface HueControlRowProps {
  value: number
  onChange: (value: number) => void
}

export const HueControlRow: React.FC<HueControlRowProps> = ({ value, onChange }) => {
  const isDefault = value === 0
  const thumbColor = `hsl(${value}, 85%, 52%)`

  return (
    <div className="editor-control-row editor-hue-control">
      <div className="editor-control-row__head">
        <span className="editor-control-row__label">色相</span>
        <span className="editor-control-row__value-group">
          <span
            className="editor-hue-control__swatch"
            style={{ background: thumbColor }}
            aria-hidden
          />
          <span className={`editor-control-row__value${isDefault ? ' is-default' : ''}`}>
            {value}°
          </span>
        </span>
      </div>
      <div
        className="editor-control-row__rail"
        style={{ ['--editor-rail-gradient' as string]: HUE_RAIL, ['--editor-hue-thumb' as string]: thumbColor }}
      >
        <Slider
          className="editor-controls-slider editor-hue-control__slider"
          min={0}
          max={360}
          value={value}
          onChange={onChange}
          onDoubleClick={() => onChange(0)}
          tooltip={{ formatter: v => `${v ?? 0}°` }}
        />
      </div>
    </div>
  )
}

interface ExposureControlRowProps {
  value: number
  onChange: (value: number) => void
  histogram: LuminanceHistogramResult
  histogramLoading?: boolean
}

export const ExposureControlRow: React.FC<ExposureControlRowProps> = ({
  value,
  onChange,
  histogram,
  histogramLoading,
}) => {
  const def = 100
  const isDefault = value === def

  return (
    <div className="editor-exposure-block">
      <EditorHistogram histogram={histogram} loading={histogramLoading} height={48} />
      <div className="editor-control-row">
        <div className="editor-control-row__head">
          <span className="editor-control-row__label">曝光</span>
          <span className={`editor-control-row__value${isDefault ? ' is-default' : ''}`}>
            {value}%
          </span>
        </div>
        <div
          className="editor-control-row__rail"
          style={{ ['--editor-rail-gradient' as string]: EXPOSURE_RAIL }}
        >
          <Slider
            className="editor-controls-slider"
            min={0}
            max={200}
            value={value}
            onChange={v => onChange(clamp(v, 0, 200))}
            onDoubleClick={() => onChange(def)}
            tooltip={{ formatter: v => `${v ?? def}%` }}
          />
        </div>
      </div>
    </div>
  )
}
