import React from 'react'
import { ControlRow, FilterButton, PanelSection } from './editorControlPrimitives'
import { numSetting, resetEditPanel } from '../../utils'
import type { ImageEditSettings } from '../../types'

interface EditorEffectsPanelProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
}

const EditorEffectsPanel: React.FC<EditorEffectsPanelProps> = ({ settings, onChange }) => {
  const handleSlider = (key: keyof ImageEditSettings) => (value: number) => {
    onChange({ [key]: value })
  }

  const handleToggleFilter = (key: keyof ImageEditSettings, value: number | boolean) => () => {
    const current = settings[key]
    if (typeof current === 'boolean') {
      onChange({ [key]: !current })
    } else {
      onChange({ [key]: current ? 0 : value })
    }
  }

  return (
    <div className="image-editor-controls-panel editor-panel-body">
      <PanelSection title="风格滤镜" onReset={() => onChange(resetEditPanel('effects'))}>
        <div className="editor-effects-chips">
          <FilterButton active={!!settings.grayscale} onClick={handleToggleFilter('grayscale', true)}>
            灰度
          </FilterButton>
          <FilterButton active={(settings.vintage || 0) > 0} onClick={handleToggleFilter('vintage', 50)}>
            复古
          </FilterButton>
          <FilterButton active={(settings.blur || 0) > 0} onClick={handleToggleFilter('blur', 5)}>
            模糊
          </FilterButton>
          <FilterButton active={(settings.sharpen || 0) > 0} onClick={handleToggleFilter('sharpen', 50)}>
            锐化
          </FilterButton>
        </div>
        {(settings.vintage || 0) > 0 && (
          <ControlRow
            label="复古强度"
            value={numSetting(settings, 'vintage', 0)}
            min={0}
            max={100}
            onChange={handleSlider('vintage')}
            unit="%"
          />
        )}
        {(settings.blur || 0) > 0 && (
          <ControlRow
            label="模糊半径"
            value={numSetting(settings, 'blur', 0)}
            min={1}
            max={20}
            onChange={handleSlider('blur')}
            unit="px"
          />
        )}
        {(settings.sharpen || 0) > 0 && (
          <ControlRow
            label="锐化强度"
            value={numSetting(settings, 'sharpen', 0)}
            min={1}
            max={100}
            onChange={handleSlider('sharpen')}
            unit="%"
          />
        )}
      </PanelSection>

      <PanelSection title="胶片质感">
        <ControlRow
          label="暗角"
          value={numSetting(settings, 'vignette', 0)}
          defaultValue={0}
          min={0}
          max={100}
          onChange={handleSlider('vignette')}
          unit="%"
        />
        <ControlRow
          label="褪色"
          value={numSetting(settings, 'fade', 0)}
          defaultValue={0}
          min={0}
          max={100}
          onChange={handleSlider('fade')}
          unit="%"
        />
        <ControlRow
          label="颗粒"
          value={numSetting(settings, 'grain', 0)}
          defaultValue={0}
          min={0}
          max={100}
          onChange={handleSlider('grain')}
          unit="%"
        />
      </PanelSection>
    </div>
  )
}

export default EditorEffectsPanel
