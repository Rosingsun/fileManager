import React from 'react'
import { ControlRow, PanelSection } from './editorControlPrimitives'
import { numSetting, resetEditPanel } from '../../utils'
import type { ImageEditSettings } from '../../types'

const TEMPERATURE_RAIL =
  'linear-gradient(90deg, #5eb3e8 0%, #e8e4dc 50%, #e8a85c 100%)'

const TINT_RAIL =
  'linear-gradient(90deg, #6ecf8a 0%, #e8e4dc 50%, #d86eb8 100%)'

interface EditorColorPanelProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
}

const EditorColorPanel: React.FC<EditorColorPanelProps> = ({ settings, onChange }) => {
  const handleSlider = (key: keyof ImageEditSettings) => (value: number) => {
    onChange({ [key]: value })
  }

  return (
    <div className="image-editor-controls-panel editor-panel-body">
      <PanelSection title="白平衡" onReset={() => onChange(resetEditPanel('color'))}>
        <ControlRow
          label="色温"
          value={numSetting(settings, 'temperature', 0)}
          defaultValue={0}
          min={-100}
          max={100}
          variant="bipolar"
          railGradient={TEMPERATURE_RAIL}
          onChange={handleSlider('temperature')}
        />
        <ControlRow
          label="色调"
          value={numSetting(settings, 'tint', 0)}
          defaultValue={0}
          min={-100}
          max={100}
          variant="bipolar"
          railGradient={TINT_RAIL}
          onChange={handleSlider('tint')}
        />
        <ControlRow
          label="伽马"
          value={numSetting(settings, 'gamma', 100)}
          defaultValue={100}
          min={50}
          max={200}
          onChange={handleSlider('gamma')}
          unit="%"
        />
      </PanelSection>

      <PanelSection title="明暗分离">
        <ControlRow
          label="阴影"
          value={numSetting(settings, 'shadows', 0)}
          defaultValue={0}
          min={-100}
          max={100}
          variant="bipolar"
          onChange={handleSlider('shadows')}
        />
        <ControlRow
          label="高光"
          value={numSetting(settings, 'highlights', 0)}
          defaultValue={0}
          min={-100}
          max={100}
          variant="bipolar"
          onChange={handleSlider('highlights')}
        />
        <ControlRow
          label="清晰度"
          value={numSetting(settings, 'clarity', 0)}
          defaultValue={0}
          min={-100}
          max={100}
          variant="bipolar"
          onChange={handleSlider('clarity')}
        />
      </PanelSection>
    </div>
  )
}

export default EditorColorPanel
