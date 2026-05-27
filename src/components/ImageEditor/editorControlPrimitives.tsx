import React from 'react'
import { Slider, Button } from 'antd'

export const PanelSection: React.FC<{
  title: string
  subtitle?: string
  onReset?: () => void
  children: React.ReactNode
}> = ({ title, subtitle, onReset, children }) => (
  <section className="editor-panel-section">
    <div className="editor-panel-section__head">
      <div className="editor-panel-section__titles">
        <h4 className="editor-panel-section__title">
          <span className="editor-panel-section__accent" aria-hidden />
          {title}
        </h4>
        {subtitle ? <p className="editor-panel-section__subtitle">{subtitle}</p> : null}
      </div>
      {onReset ? (
        <Button type="text" size="small" className="editor-panel-section__reset" onClick={onReset}>
          重置本节
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

  const showBipolarTicks = bipolar && min < 0 && max > 0

  return (
    <div
      className={`editor-param${bipolar ? ' is-bipolar' : ''}${!isDefault ? ' is-modified' : ''}${railGradient ? ' has-gradient-rail' : ''}`}
    >
      <div className="editor-param__head">
        <span className="editor-param__label">{label}</span>
        <div className="editor-param__meta">
          {!isDefault ? (
            <button
              type="button"
              className="editor-param__reset"
              onClick={() => onChange(def)}
              aria-label={`重置${label}`}
            >
              重置
            </button>
          ) : null}
          <span className={`editor-param__value${isDefault ? ' is-default' : ' is-active'}`}>
            {formatDisplay()}
            {unit}
          </span>
        </div>
      </div>
      <div
        className="editor-param__rail"
        style={railGradient ? { ['--editor-rail-gradient' as string]: railGradient } : undefined}
      >
        {bipolar && center != null ? (
          <span className="editor-param__center" style={{ left: '50%' }} aria-hidden />
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
      {showBipolarTicks ? (
        <div className="editor-param__ticks" aria-hidden>
          <span>{min}</span>
          <span>0</span>
          <span>+{max}</span>
        </div>
      ) : null}
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
    aria-pressed={active}
  >
    <span className="editor-effect-chip__indicator" aria-hidden />
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
