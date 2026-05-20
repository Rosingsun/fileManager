import React from 'react'
import { Button } from 'antd'
import { TbSparkles } from '../icons'
import { ControlRow, PanelSection } from './editorControlPrimitives'
import { HueControlRow, ExposureControlRow } from './editorSpecialControls'
import { numSetting, resetEditPanel } from '../../utils'
import { useImageHistogram } from '../../hooks'
import type { ImageEditSettings } from '../../types'

const SATURATION_RAIL =
  'linear-gradient(90deg, #6b6b6b 0%, #c41e3a 50%, #ff2d55 100%)'

const BRIGHTNESS_RAIL =
  'linear-gradient(90deg, #0d0d0d 0%, #a0a0a0 50%, #ffffff 100%)'

const CONTRAST_RAIL =
  'linear-gradient(90deg, #808080 0%, #404040 50%, #101010 100%)'

interface EditorAdjustPanelProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
  previewSrc: string | null
  settingsDigest: string
  onAutoEnhance?: () => void
  autoEnhanceLoading?: boolean
}

const EditorAdjustPanel: React.FC<EditorAdjustPanelProps> = ({
  settings,
  onChange,
  previewSrc,
  settingsDigest,
  onAutoEnhance,
  autoEnhanceLoading,
}) => {
  const { histogram, loading: histLoading } = useImageHistogram(previewSrc, settingsDigest)

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
        <ExposureControlRow
          value={numSetting(settings, 'exposure', 100)}
          onChange={handleSlider('exposure')}
          histogram={histogram}
          histogramLoading={histLoading}
        />
        <ControlRow
          label="亮度"
          value={numSetting(settings, 'brightness', 100)}
          defaultValue={100}
          min={0}
          max={200}
          onChange={handleSlider('brightness')}
          unit="%"
          railGradient={BRIGHTNESS_RAIL}
        />
        <ControlRow
          label="对比度"
          value={numSetting(settings, 'contrast', 100)}
          defaultValue={100}
          min={0}
          max={200}
          onChange={handleSlider('contrast')}
          unit="%"
          railGradient={CONTRAST_RAIL}
        />
        <ControlRow
          label="饱和度"
          value={numSetting(settings, 'saturation', 100)}
          defaultValue={100}
          min={0}
          max={200}
          onChange={handleSlider('saturation')}
          unit="%"
          railGradient={SATURATION_RAIL}
        />
        <HueControlRow
          value={numSetting(settings, 'hue', 0)}
          onChange={handleSlider('hue')}
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
