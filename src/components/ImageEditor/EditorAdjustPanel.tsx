import React from 'react'
import { Button } from 'antd'
import { TbSparkles } from '../icons'
import { ControlRow, PanelSection } from './editorControlPrimitives'
import { numSetting, resetEditPanel } from '../../utils'
import type { ImageEditSettings } from '../../types'

interface EditorAdjustPanelProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
  onAutoEnhance?: () => void
  autoEnhanceLoading?: boolean
}

const EditorAdjustPanel: React.FC<EditorAdjustPanelProps> = ({
  settings,
  onChange,
  onAutoEnhance,
  autoEnhanceLoading,
}) => {
  const handleSlider = (key: keyof ImageEditSettings) => (value: number) => {
    onChange({ [key]: value })
  }

  return (
    <div className="image-editor-controls-panel editor-panel-body">
      {onAutoEnhance && (
        <div className="editor-adjust-hero">
          <Button
            type="primary"
            icon={<TbSparkles size={16} />}
            block
            size="middle"
            loading={autoEnhanceLoading}
            onClick={onAutoEnhance}
          >
            智能增强
          </Button>
          <p className="editor-adjust-hero__hint">分析画面并填入专业级起点，可逐项微调</p>
        </div>
      )}

      <PanelSection title="光效" onReset={() => onChange(resetEditPanel('adjust'))}>
        <ControlRow
          label="曝光"
          value={numSetting(settings, 'exposure', 100)}
          defaultValue={100}
          min={0}
          max={200}
          onChange={handleSlider('exposure')}
          unit="%"
        />
        <ControlRow
          label="亮度"
          value={numSetting(settings, 'brightness', 100)}
          defaultValue={100}
          min={0}
          max={200}
          onChange={handleSlider('brightness')}
          unit="%"
        />
        <ControlRow
          label="对比度"
          value={numSetting(settings, 'contrast', 100)}
          defaultValue={100}
          min={0}
          max={200}
          onChange={handleSlider('contrast')}
          unit="%"
        />
        <ControlRow
          label="饱和度"
          value={numSetting(settings, 'saturation', 100)}
          defaultValue={100}
          min={0}
          max={200}
          onChange={handleSlider('saturation')}
          unit="%"
        />
        <ControlRow
          label="色相"
          value={numSetting(settings, 'hue', 0)}
          defaultValue={0}
          min={0}
          max={360}
          onChange={handleSlider('hue')}
          unit="°"
        />
      </PanelSection>

      <PanelSection title="细节">
        <ControlRow
          label="降噪"
          value={numSetting(settings, 'denoise', 0)}
          defaultValue={0}
          min={0}
          max={100}
          onChange={handleSlider('denoise')}
          unit="%"
        />
      </PanelSection>
    </div>
  )
}

export default EditorAdjustPanel
