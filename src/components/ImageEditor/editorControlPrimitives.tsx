import React from 'react'
import { Slider, Button } from 'antd'

export const PanelSection: React.FC<{
  title: string
  onReset?: () => void
  children: React.ReactNode
}> = ({ title, onReset, children }) => (
  <section className="editor-panel-section">
    <div className="editor-panel-section__head">
      <h4 className="editor-panel-section__title">{title}</h4>
      {onReset ? (
        <Button type="text" size="small" className="editor-panel-section__reset" onClick={onReset}>
          重置
        </Button>
      ) : null}
    </div>
    <div className="editor-panel-section__body">{children}</div>
  </section>
)

export const SectionTitle: React.FC<{
  children: React.ReactNode
  icon?: React.ReactNode
}> = ({ children, icon }) => (
  <div className="editor-section-title">
    {icon ? <span className="editor-section-title__icon">{icon}</span> : null}
    {children}
  </div>
)

export const ControlRow: React.FC<{
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  unit?: string
  defaultValue?: number
  variant?: 'standard' | 'bipolar'
  railGradient?: string
}> = ({
  label,
  value,
  min,
  max,
  onChange,
  unit = '',
  defaultValue,
  variant = 'standard',
  railGradient,
}) => {
  const def = defaultValue ?? (variant === 'bipolar' ? 0 : min)
  const isDefault = value === def
  const bipolar = variant === 'bipolar'
  const center = bipolar ? (min + max) / 2 : null

  const formatDisplay = () => {
    if (bipolar && value > 0) return `+${value}`
    return `${value}`
  }

  return (
    <div className={`editor-control-row${bipolar ? ' is-bipolar' : ''}`}>
      <div className="editor-control-row__head">
        <span className="editor-control-row__label">{label}</span>
        <span className={`editor-control-row__value${isDefault ? ' is-default' : ''}`}>
          {formatDisplay()}
          {unit}
        </span>
      </div>
      <div
        className="editor-control-row__rail"
        style={railGradient ? { ['--editor-rail-gradient' as string]: railGradient } : undefined}
      >
        {bipolar && center != null ? (
          <span className="editor-control-row__center" style={{ left: '50%' }} aria-hidden />
        ) : null}
        <Slider
          className="editor-controls-slider"
          min={min}
          max={max}
          value={value}
          onChange={onChange}
          onDoubleClick={() => onChange(def)}
          tooltip={{ formatter: v => `${v ?? def}${unit}` }}
        />
      </div>
    </div>
  )
}

export const FilterButton: React.FC<{
  active: boolean
  onClick: () => void
  children: React.ReactNode
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    className={`editor-effect-chip${active ? ' is-active' : ''}`}
    onClick={onClick}
  >
    {children}
  </button>
)

export function defaultSettingValue(
  settings: Record<string, unknown>,
  key: string,
  def: number
): number {
  const val = settings[key]
  return typeof val === 'number' ? val : def
}
