import React from 'react'
import { Slider, InputNumber, Switch, Space } from 'antd'
import type { ImageEditSettings } from '../../types'

interface EditorControlsProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
}

const EditorControls: React.FC<EditorControlsProps> = ({ settings, onChange }) => {
  const handleSlider = (key: keyof ImageEditSettings) => (value: number) => {
    onChange({ [key]: value })
  }

  const handleCheckbox = (key: keyof ImageEditSettings) => (checked: boolean) => {
    onChange({ [key]: checked })
  }

  const handleCropChange = (field: keyof NonNullable<ImageEditSettings['crop']>) => (value: number | null) => {
    const v = value || 0
    onChange({ crop: { ...(settings.crop || { x: 0, y: 0, width: 0, height: 0 }), [field]: v } })
  }

  return (
    <div style={{ padding: 16, maxWidth: 300 }}>
      <div>
        <span>亮度</span>
        <Slider
          min={0}
          max={200}
          value={settings.brightness || 100}
          onChange={handleSlider('brightness')}
        />
      </div>
      <div>
        <span>对比度</span>
        <Slider
          min={0}
          max={200}
          value={settings.contrast || 100}
          onChange={handleSlider('contrast')}
        />
      </div>
      <div>
        <span>饱和度</span>
        <Slider
          min={0}
          max={200}
          value={settings.saturation || 100}
          onChange={handleSlider('saturation')}
        />
      </div>
      <div>
        <span>色相</span>
        <Slider
          min={0}
          max={360}
          value={settings.hue || 0}
          onChange={handleSlider('hue')}
        />
      </div>
      <div>
        <span>曝光</span>
        <Slider
          min={0}
          max={200}
          value={settings.exposure || 100}
          onChange={handleSlider('exposure')}
        />
      </div>
      <div>
        <span>旋转(°)</span>
        <InputNumber
          min={0}
          max={360}
          value={settings.rotation || 0}
          onChange={v => onChange({ rotation: v || 0 })}
        />
      </div>
      <Space style={{ marginTop: 8 }}>
        <span>水平翻转</span>
        <Switch checked={settings.flipHorizontal} onChange={handleCheckbox('flipHorizontal')} />
        <span>垂直翻转</span>
        <Switch checked={settings.flipVertical} onChange={handleCheckbox('flipVertical')} />
      </Space>
      <div style={{ marginTop: 16 }}>
        <h4>裁切 (x,y,w,h)</h4>
        <Space>
          <InputNumber value={settings.crop?.x || 0} onChange={handleCropChange('x')} />
          <InputNumber value={settings.crop?.y || 0} onChange={handleCropChange('y')} />
          <InputNumber value={settings.crop?.width || 0} onChange={handleCropChange('width')} />
          <InputNumber value={settings.crop?.height || 0} onChange={handleCropChange('height')} />
        </Space>
      </div>
    </div>
  )
}

export default EditorControls
