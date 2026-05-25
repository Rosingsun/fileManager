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
    <div className={`editor-param editor-hue-control has-gradient-rail${isDefault ? '' : ' is-modified'}`}>
      <div className="editor-param__head">
        <span className="editor-param__label">色相</span>
        <div className="editor-param__meta">
          {!isDefault ? (
            <button
              type="button"
              className="editor-param__reset"
              onClick={() => onChange(0)}
              aria-label="重置色相"
            >
              重置
            </button>
          ) : null}
          <span className="editor-param__value-group">
            <span
              className="editor-hue-control__swatch"
              style={{ background: thumbColor }}
              aria-hidden
            />
            <span className={`editor-param__value${isDefault ? ' is-default' : ' is-active'}`}>
              {value}°
            </span>
          </span>
        </div>
      </div>
      <div
        className="editor-param__rail"
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
    <div className={`editor-exposure-block${isDefault ? '' : ' is-modified'}`}>
      <div className="editor-exposure-block__hist">
        <span className="editor-exposure-block__hist-label">亮度分布</span>
        <EditorHistogram histogram={histogram} loading={histogramLoading} height={52} />
      </div>
      <div className={`editor-param has-gradient-rail${isDefault ? '' : ' is-modified'}`}>
        <div className="editor-param__head">
          <span className="editor-param__label">曝光</span>
          <div className="editor-param__meta">
            {!isDefault ? (
              <button
                type="button"
                className="editor-param__reset"
                onClick={() => onChange(def)}
                aria-label="重置曝光"
              >
                重置
              </button>
            ) : null}
            <span className={`editor-param__value${isDefault ? ' is-default' : ' is-active'}`}>
              {value}%
            </span>
          </div>
        </div>
        <div
          className="editor-param__rail"
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
        <div className="editor-param__ticks editor-param__ticks--exposure" aria-hidden>
          <span>欠曝</span>
          <span>标准</span>
          <span>过曝</span>
        </div>
      </div>
    </div>
  )
}
