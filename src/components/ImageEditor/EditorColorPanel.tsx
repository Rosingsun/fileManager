import React, { useState } from 'react'
import { Button, Collapse } from 'antd'
import { TbColorPicker } from '../icons'
import { ControlRow, PanelSection } from './editorControlPrimitives'
import {
  numSetting,
  resetEditPanel,
  HSL_HUE_REGIONS,
} from '../../utils'
import type { HslHueRegionAdjust, HslHueRegionId, ImageEditSettings } from '../../types'

const TEMPERATURE_RAIL =
  'linear-gradient(90deg, #5eb3e8 0%, #e8e4dc 50%, #e8a85c 100%)'

const TINT_RAIL =
  'linear-gradient(90deg, #6ecf8a 0%, #e8e4dc 50%, #d86eb8 100%)'

const REGION_COLORS: Record<HslHueRegionId, string> = {
  red: '#ff3b30',
  orange: '#ff9500',
  yellow: '#ffcc00',
  green: '#34c759',
  cyan: '#5ac8fa',
  blue: '#007aff',
  purple: '#af52de',
  magenta: '#ff2d55',
}

interface EditorColorPanelProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
  onPickWhiteBalance?: () => void
  pickWhiteBalanceActive?: boolean
}

const EditorColorPanel: React.FC<EditorColorPanelProps> = ({
  settings,
  onChange,
  onPickWhiteBalance,
  pickWhiteBalanceActive,
}) => {
  const [hslOpen, setHslOpen] = useState(false)

  const handleSlider = (key: keyof ImageEditSettings) => (value: number) => {
    onChange({ [key]: value })
  }

  const hsl = settings.hslHueAdjust ?? {}

  const setHslRegion = (id: HslHueRegionId, field: keyof HslHueRegionAdjust, value: number) => {
    const prev = hsl[id] ?? {}
    onChange({
      hslHueAdjust: {
        ...hsl,
        [id]: { ...prev, [field]: value },
      },
    })
  }

  return (
    <div className="image-editor-controls-panel editor-panel-body">
      <PanelSection title="白平衡" onReset={() => onChange(resetEditPanel('color'))}>
        {onPickWhiteBalance ? (
          <Button
            type={pickWhiteBalanceActive ? 'primary' : 'default'}
            size="small"
            block
            icon={<TbColorPicker size={16} />}
            className="editor-wb-pick-btn"
            onClick={onPickWhiteBalance}
          >
            {pickWhiteBalanceActive ? '点击预览中的中性灰区域…' : '灰点取色（点击预览）'}
          </Button>
        ) : null}
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

      <PanelSection title="氛围">
        <ControlRow
          label="去雾"
          value={numSetting(settings, 'dehaze', 0)}
          defaultValue={0}
          min={0}
          max={100}
          onChange={handleSlider('dehaze')}
          unit="%"
        />
        <ControlRow
          label="鲜明度"
          value={numSetting(settings, 'vibrance', 0)}
          defaultValue={0}
          min={-100}
          max={100}
          variant="bipolar"
          onChange={handleSlider('vibrance')}
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

      <Collapse
        ghost
        className="editor-hsl-collapse"
        activeKey={hslOpen ? ['hsl'] : []}
        onChange={keys => setHslOpen(keys.includes('hsl'))}
        items={[
          {
            key: 'hsl',
            label: 'HSL 分色相（8 色）',
            children: (
              <div className="editor-hsl-regions">
                {HSL_HUE_REGIONS.map(region => (
                  <div key={region.id} className="editor-hsl-region">
                    <span
                      className="editor-hsl-region__dot"
                      style={{ background: REGION_COLORS[region.id] }}
                    />
                    <span className="editor-hsl-region__label">{region.label}</span>
                    <ControlRow
                      label="色相"
                      value={hsl[region.id]?.h ?? 0}
                      defaultValue={0}
                      min={-100}
                      max={100}
                      variant="bipolar"
                      onChange={v => setHslRegion(region.id, 'h', v)}
                    />
                    <ControlRow
                      label="饱和"
                      value={hsl[region.id]?.s ?? 0}
                      defaultValue={0}
                      min={-100}
                      max={100}
                      variant="bipolar"
                      onChange={v => setHslRegion(region.id, 's', v)}
                    />
                    <ControlRow
                      label="明度"
                      value={hsl[region.id]?.l ?? 0}
                      defaultValue={0}
                      min={-100}
                      max={100}
                      variant="bipolar"
                      onChange={v => setHslRegion(region.id, 'l', v)}
                    />
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}

export default EditorColorPanel
