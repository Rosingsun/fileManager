import React from 'react'
import { Slider, InputNumber, Switch, Space, Divider, Button } from 'antd'
import { ScissorOutlined, SwapOutlined } from '@ant-design/icons'
import type { ImageEditSettings } from '../../types'

interface EditorControlsProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
  showCropMode?: boolean
  onToggleCropMode?: (show: boolean) => void
  imageWidth?: number
  imageHeight?: number
}

const ControlRow: React.FC<{
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  unit?: string
}> = ({ label, value, min, max, onChange, unit = '' }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      marginBottom: 4,
      fontSize: 12,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
    }}>
      <span style={{ color: '#333' }}>{label}</span>
      <span style={{ color: '#666', minWidth: 40, textAlign: 'right' }}>{value}{unit}</span>
    </div>
    <Slider
      min={min}
      max={max}
      value={value}
      onChange={onChange}
      styles={{
        track: { background: '#007AFF' },
        rail: { background: '#E5E5EA' }
      }}
    />
  </div>
)

const FilterButton: React.FC<{
  active: boolean
  onClick: () => void
  children: React.ReactNode
}> = ({ active, onClick, children }) => (
  <Button
    type={active ? 'primary' : 'default'}
    size="small"
    onClick={onClick}
    style={{ 
      borderRadius: 6,
      fontSize: 12
    }}
  >
    {children}
  </Button>
)

const EditorControls: React.FC<EditorControlsProps> = ({ settings, onChange, showCropMode, onToggleCropMode, imageWidth = 800, imageHeight = 600 }) => {
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

  const handleToggleFilter = (key: keyof ImageEditSettings, value: any) => () => {
    const current = settings[key]
    if (typeof current === 'boolean') {
      onChange({ [key]: !current })
    } else {
      onChange({ [key]: current ? 0 : value })
    }
  }

  const defaultValue = (key: keyof ImageEditSettings, def: number) => {
    const val = settings[key]
    return typeof val === 'number' ? val : def
  }

  return (
    <div style={{ 
      padding: 12, 
      maxWidth: 300,
      maxHeight: 520,
      overflowY: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
    }}>
      <h4 style={{ 
        marginBottom: 12, 
        fontSize: 12, 
        fontWeight: 600,
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 0.5
      }}>基础调整</h4>
      
      <ControlRow
        label="亮度"
        value={defaultValue('brightness', 100)}
        min={0}
        max={200}
        onChange={handleSlider('brightness')}
        unit="%"
      />
      <ControlRow
        label="对比度"
        value={defaultValue('contrast', 100)}
        min={0}
        max={200}
        onChange={handleSlider('contrast')}
        unit="%"
      />
      <ControlRow
        label="饱和度"
        value={defaultValue('saturation', 100)}
        min={0}
        max={200}
        onChange={handleSlider('saturation')}
        unit="%"
      />
      <ControlRow
        label="曝光"
        value={defaultValue('exposure', 100)}
        min={0}
        max={200}
        onChange={handleSlider('exposure')}
        unit="%"
      />
      <ControlRow
        label="色相"
        value={defaultValue('hue', 0)}
        min={0}
        max={360}
        onChange={handleSlider('hue')}
        unit="°"
      />

      <Divider style={{ margin: '12px 0' }} />

      <h4 style={{ 
        marginBottom: 12, 
        fontSize: 12, 
        fontWeight: 600,
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 0.5
      }}>滤镜</h4>
      
      <Space wrap style={{ marginBottom: 12 }}>
        <FilterButton 
          active={!!settings.grayscale} 
          onClick={handleToggleFilter('grayscale', true)}
        >
          灰度
        </FilterButton>
        <FilterButton 
          active={(settings.vintage || 0) > 0} 
          onClick={handleToggleFilter('vintage', 50)}
        >
          复古
        </FilterButton>
      </Space>
      
      {(settings.vintage || 0) > 0 && (
        <ControlRow
          label="复古强度"
          value={defaultValue('vintage', 0)}
          min={0}
          max={100}
          onChange={handleSlider('vintage')}
          unit="%"
        />
      )}
      
      <Space wrap style={{ marginBottom: 12 }}>
        <FilterButton 
          active={(settings.blur || 0) > 0} 
          onClick={handleToggleFilter('blur', 5)}
        >
          模糊
        </FilterButton>
        <FilterButton 
          active={(settings.sharpen || 0) > 0} 
          onClick={handleToggleFilter('sharpen', 50)}
        >
          锐化
        </FilterButton>
      </Space>
      
      {(settings.blur || 0) > 0 && (
        <ControlRow
          label="模糊半径"
          value={defaultValue('blur', 0)}
          min={1}
          max={20}
          onChange={handleSlider('blur')}
          unit="px"
        />
      )}
      
      {(settings.sharpen || 0) > 0 && (
        <ControlRow
          label="锐化强度"
          value={defaultValue('sharpen', 0)}
          min={1}
          max={100}
          onChange={handleSlider('sharpen')}
          unit="%"
        />
      )}

      <Divider style={{ margin: '12px 0' }} />

      <h4 style={{ 
        marginBottom: 12, 
        fontSize: 12, 
        fontWeight: 600,
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 0.5
      }}>高级</h4>
      
      <ControlRow
        label="阴影"
        value={defaultValue('shadows', 0)}
        min={-100}
        max={100}
        onChange={handleSlider('shadows')}
      />
      <ControlRow
        label="高光"
        value={defaultValue('highlights', 0)}
        min={-100}
        max={100}
        onChange={handleSlider('highlights')}
      />
      <ControlRow
        label="清晰度"
        value={defaultValue('clarity', 0)}
        min={-100}
        max={100}
        onChange={handleSlider('clarity')}
      />

      <Divider style={{ margin: '12px 0' }} />

      <h4 style={{ 
        marginBottom: 12, 
        fontSize: 12, 
        fontWeight: 600,
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 0.5
      }}><SwapOutlined style={{ marginRight: 4 }} />变换</h4>
      
      <div style={{ marginBottom: 12 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginBottom: 4,
          fontSize: 12
        }}>
          <span style={{ color: '#333' }}>旋转角度</span>
          <InputNumber
            min={0}
            max={360}
            value={defaultValue('rotation', 0)}
            onChange={v => onChange({ rotation: v || 0 })}
            style={{ width: 60 }}
            size="small"
          />
        </div>
      </div>

      <Space style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#333' }}>水平翻转</span>
        <Switch 
          checked={settings.flipHorizontal} 
          onChange={handleCheckbox('flipHorizontal')}
          size="small"
        />
        <span style={{ fontSize: 12, color: '#333' }}>垂直翻转</span>
        <Switch 
          checked={settings.flipVertical} 
          onChange={handleCheckbox('flipVertical')}
          size="small"
        />
      </Space>

      <Divider style={{ margin: '12px 0' }} />

      <h4 style={{ 
        marginBottom: 12, 
        fontSize: 12, 
        fontWeight: 600,
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 0.5
      }}><ScissorOutlined style={{ marginRight: 4 }} />裁切
        <Button 
          size="small" 
          type={showCropMode ? 'primary' : 'default'}
          onClick={() => onToggleCropMode?.(!showCropMode)}
          style={{ marginLeft: 8 }}
        >
          {showCropMode ? '关闭' : '开启'}
        </Button>
      </h4>
      
      {showCropMode && (
        <>
          <Space wrap size="small" style={{ marginBottom: 12 }}>
            <Button size="small" type={!settings.crop ? 'primary' : 'default'} onClick={() => onChange({ crop: undefined })}>自由</Button>
            <Button size="small" onClick={() => {
              const size = Math.min(imageWidth, imageHeight)
              onChange({ crop: { x: 0, y: 0, width: size, height: size } })
            }}>1:1</Button>
            <Button size="small" onClick={() => {
              const w = imageWidth
              const h = Math.round(w * 3 / 4)
              onChange({ crop: { x: 0, y: 0, width: Math.min(w, imageWidth), height: Math.min(h, imageHeight) } })
            }}>4:3</Button>
            <Button size="small" onClick={() => {
              const w = imageWidth
              const h = Math.round(w * 9 / 16)
              onChange({ crop: { x: 0, y: 0, width: Math.min(w, imageWidth), height: Math.min(h, imageHeight) } })
            }}>16:9</Button>
          </Space>
      
          <Space>
            <div>
              <span style={{ fontSize: 10, color: '#666' }}>X</span>
              <InputNumber 
                value={settings.crop?.x || 0} 
                onChange={handleCropChange('x')}
                size="small"
                style={{ width: 50 }}
              />
            </div>
            <div>
              <span style={{ fontSize: 10, color: '#666' }}>Y</span>
              <InputNumber 
                value={settings.crop?.y || 0} 
                onChange={handleCropChange('y')}
                size="small"
                style={{ width: 50 }}
              />
            </div>
            <div>
              <span style={{ fontSize: 10, color: '#666' }}>W</span>
              <InputNumber 
                value={settings.crop?.width || 0} 
                onChange={handleCropChange('width')}
                size="small"
                style={{ width: 50 }}
              />
            </div>
            <div>
              <span style={{ fontSize: 10, color: '#666' }}>H</span>
              <InputNumber 
                value={settings.crop?.height || 0} 
                onChange={handleCropChange('height')}
                size="small"
                style={{ width: 50 }}
              />
            </div>
          </Space>
        </>
      )}
    </div>
  )
}

export default EditorControls
