import React from 'react'
import { Slider, InputNumber, Switch, Space, Button } from 'antd'
import { ScissorOutlined, SwapOutlined } from '@ant-design/icons'
import { computeCropRectForAspectRatio } from '../../utils'
import type { ImageEditSettings } from '../../types'

const CROP_ASPECT_PRESETS: readonly { label: string; w: number; h: number }[] = [
  { label: '1:1', w: 1, h: 1 },
  { label: '4:3', w: 4, h: 3 },
  { label: '3:4', w: 3, h: 4 },
  { label: '16:9', w: 16, h: 9 },
  { label: '9:16', w: 9, h: 16 },
  { label: '3:2', w: 3, h: 2 },
  { label: '2:3', w: 2, h: 3 },
]

interface EditorControlsProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
  showCropMode?: boolean
  onToggleCropMode?: (show: boolean) => void
  imageWidth?: number
  imageHeight?: number
}

const SectionTitle: React.FC<{
  children: React.ReactNode
  icon?: React.ReactNode
}> = ({ children, icon }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    fontSize: 12,
    fontWeight: 600,
    color: '#6e6e73',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    padding: '0 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
  }}>
    {icon && <span style={{ color: '#007AFF' }}>{icon}</span>}
    {children}
  </div>
)

const ControlRow: React.FC<{
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  unit?: string
}> = ({ label, value, min, max, onChange, unit = '' }) => (
  <div style={{
    marginBottom: 16,
    padding: '0 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
  }}>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 6,
      fontSize: 12,
      color: '#1d1d1f'
    }}>
      <span>{label}</span>
      <span style={{
        color: '#6e6e73',
        minWidth: 40,
        textAlign: 'right',
        fontWeight: 500
      }}>
        {value}{unit}
      </span>
    </div>
    <Slider
      className="editor-controls-slider"
      min={min}
      max={max}
      value={value}
      onChange={onChange}
      styles={{
        track: {
          background: '#007AFF',
          borderRadius: 4,
          height: 4
        },
        rail: {
          background: '#e5e5ea',
          borderRadius: 4,
          height: 4
        },
        /** 外层不要用白底+阴影，否则会与 antd 圆形 ::before 旋钮叠成「方块+圆」 */
        handle: {
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
        },
      }}
      transitionName="slider-transition"
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
      borderRadius: 8,
      fontSize: 13,
      padding: '6px 12px',
      fontWeight: 500,
      border: active ? 'none' : '1px solid rgba(0, 0, 0, 0.1)',
      background: active ? '#007AFF' : '#ffffff',
      color: active ? '#ffffff' : '#1d1d1f',
      boxShadow: active ? '0 2px 8px rgba(0, 122, 255, 0.3)' : 'none',
      transition: 'all 0.2s ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'rgba(245, 245, 247, 0.8)'
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = '#ffffff'
      }
    }}
  >
    {children}
  </Button>
)

const MIN_CROP_DIM = 20

const EditorControls: React.FC<EditorControlsProps> = ({ settings, onChange, showCropMode, onToggleCropMode, imageWidth = 800, imageHeight = 600 }) => {
  const handleSlider = (key: keyof ImageEditSettings) => (value: number) => {
    onChange({ [key]: value })
  }

  const handleCheckbox = (key: keyof ImageEditSettings) => (checked: boolean) => {
    onChange({ [key]: checked })
  }

  const clampCropRect = (rect: NonNullable<ImageEditSettings['crop']>): NonNullable<ImageEditSettings['crop']> => {
    let { x, y, width, height } = rect
    width = Math.max(MIN_CROP_DIM, Math.min(width, imageWidth))
    height = Math.max(MIN_CROP_DIM, Math.min(height, imageHeight))
    x = Math.max(0, Math.min(x, imageWidth - MIN_CROP_DIM))
    y = Math.max(0, Math.min(y, imageHeight - MIN_CROP_DIM))
    width = Math.min(width, imageWidth - x)
    height = Math.min(height, imageHeight - y)
    width = Math.max(MIN_CROP_DIM, width)
    height = Math.max(MIN_CROP_DIM, height)
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    }
  }

  const handleCropChange = (field: keyof NonNullable<ImageEditSettings['crop']>) => (value: number | null) => {
    const v = value ?? 0
    const base =
      settings.crop ?? { x: 0, y: 0, width: imageWidth, height: imageHeight }
    const next = clampCropRect({ ...base, [field]: v })
    onChange({ crop: next })
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
      width: '100%',
      overflowY: 'auto',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      scrollbarWidth: 'thin',
      scrollbarColor: '#c7c7cc transparent',
      '&::-webkit-scrollbar': {
        width: 6,
        backgroundColor: 'transparent'
      },
      '&::-webkit-scrollbar-thumb': {
        backgroundColor: '#c7c7cc',
        borderRadius: 3
      }
    }}>
      {/* 基础调整 */}
      <div style={{ marginBottom: 8 }}>
        <SectionTitle>基础调整</SectionTitle>
        
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
      </div>

      {/* 滤镜 */}
      <div style={{
        marginBottom: 8,
        paddingTop: 12,
        borderTop: '1px solid rgba(0, 0, 0, 0.08)'
      }}>
        <SectionTitle>滤镜</SectionTitle>
        
        <div style={{ padding: '0 16px', marginBottom: 16 }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12
          }}>
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
          </div>
          
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
        </div>
      </div>

      {/* 高级 */}
      <div style={{
        marginBottom: 8,
        paddingTop: 12,
        borderTop: '1px solid rgba(0, 0, 0, 0.08)'
      }}>
        <SectionTitle>高级</SectionTitle>
        
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
      </div>

      {/* 变换 */}
      <div style={{
        marginBottom: 8,
        paddingTop: 12,
        borderTop: '1px solid rgba(0, 0, 0, 0.08)'
      }}>
        <SectionTitle icon={<SwapOutlined />}>变换</SectionTitle>
        
        <div style={{
          padding: '0 16px',
          marginBottom: 16
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12
          }}>
            <span style={{ fontSize: 12, color: '#1d1d1f' }}>旋转角度</span>
            <InputNumber
              min={0}
              max={360}
              value={defaultValue('rotation', 0)}
              onChange={v => onChange({ rotation: v || 0 })}
              style={{
                width: 80,
                borderRadius: 6,
                border: '1px solid rgba(0, 0, 0, 0.1)',
                fontSize: 12
              }}
              size="small"
            />
          </div>
        </div>

        <div style={{
          padding: '0 16px',
          marginBottom: 16
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: 12, color: '#1d1d1f' }}>水平翻转</span>
            <Switch
              checked={settings.flipHorizontal}
              onChange={handleCheckbox('flipHorizontal')}
              size="small"
              checkedChildren=""
              unCheckedChildren=""
              style={{
                backgroundColor: settings.flipHorizontal ? '#007AFF' : '#e5e5ea',
                '& .ant-switch-handle': {
                  borderRadius: '50%',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }
              }}
            />
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 12
          }}>
            <span style={{ fontSize: 12, color: '#1d1d1f' }}>垂直翻转</span>
            <Switch
              checked={settings.flipVertical}
              onChange={handleCheckbox('flipVertical')}
              size="small"
              checkedChildren=""
              unCheckedChildren=""
              style={{
                backgroundColor: settings.flipVertical ? '#007AFF' : '#e5e5ea',
                '& .ant-switch-handle': {
                  borderRadius: '50%',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* 裁切 */}
      <div style={{
        marginBottom: 24,
        paddingTop: 12,
        borderTop: '1px solid rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          marginBottom: 16
        }}>
          <SectionTitle icon={<ScissorOutlined />}>裁切</SectionTitle>
          <Button
            size="small"
            type={showCropMode ? 'primary' : 'default'}
            onClick={() => onToggleCropMode?.(!showCropMode)}
            style={{
              borderRadius: 8,
              fontSize: 13,
              padding: '6px 12px',
              fontWeight: 500,
              border: showCropMode ? 'none' : '1px solid rgba(0, 0, 0, 0.1)',
              background: showCropMode ? '#007AFF' : '#ffffff',
              color: showCropMode ? '#ffffff' : '#1d1d1f',
              boxShadow: showCropMode ? '0 2px 8px rgba(0, 122, 255, 0.3)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {showCropMode ? '关闭' : '开启'}
          </Button>
        </div>
        
        {showCropMode && (
          <>
            <div style={{
              padding: '0 16px',
              marginBottom: 16
            }}>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 16
              }}>
                <Button
                  size="small"
                  type={!settings.crop ? 'primary' : 'default'}
                  onClick={() => onChange({ crop: undefined })}
                  style={{
                    borderRadius: 8,
                    fontSize: 13,
                    padding: '6px 12px',
                    fontWeight: 500,
                    border: !settings.crop ? 'none' : '1px solid rgba(0, 0, 0, 0.1)',
                    background: !settings.crop ? '#007AFF' : '#ffffff',
                    color: !settings.crop ? '#ffffff' : '#1d1d1f',
                    boxShadow: !settings.crop ? '0 2px 8px rgba(0, 122, 255, 0.3)' : 'none'
                  }}
                >
                  自由
                </Button>
                {CROP_ASPECT_PRESETS.map(preset => (
                  <Button
                    key={`${preset.w}-${preset.h}`}
                    size="small"
                    onClick={() => {
                      const rect = computeCropRectForAspectRatio(imageWidth, imageHeight, preset.w, preset.h)
                      onChange({ crop: rect })
                    }}
                    style={{
                      borderRadius: 8,
                      fontSize: 13,
                      padding: '6px 10px',
                      fontWeight: 500,
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      background: '#ffffff',
                      color: '#1d1d1f'
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              {!settings.crop && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#6e6e73',
                    marginBottom: 8,
                    letterSpacing: 0.3,
                  }}>
                    像素微调
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#6e6e73', marginBottom: 4 }}>X</div>
                      <InputNumber
                        value={0}
                        onChange={handleCropChange('x')}
                        min={0}
                        max={Math.max(0, imageWidth - MIN_CROP_DIM)}
                        size="small"
                        style={{
                          width: '100%',
                          borderRadius: 6,
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          fontSize: 12,
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#6e6e73', marginBottom: 4 }}>Y</div>
                      <InputNumber
                        value={0}
                        onChange={handleCropChange('y')}
                        min={0}
                        max={Math.max(0, imageHeight - MIN_CROP_DIM)}
                        size="small"
                        style={{
                          width: '100%',
                          borderRadius: 6,
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          fontSize: 12,
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#6e6e73', marginBottom: 4 }}>宽度</div>
                      <InputNumber
                        value={imageWidth}
                        onChange={handleCropChange('width')}
                        min={MIN_CROP_DIM}
                        max={imageWidth}
                        size="small"
                        style={{
                          width: '100%',
                          borderRadius: 6,
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          fontSize: 12,
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#6e6e73', marginBottom: 4 }}>高度</div>
                      <InputNumber
                        value={imageHeight}
                        onChange={handleCropChange('height')}
                        min={MIN_CROP_DIM}
                        max={imageHeight}
                        size="small"
                        style={{
                          width: '100%',
                          borderRadius: 6,
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          fontSize: 12,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <p style={{
                margin: 0,
                fontSize: 11,
                color: '#86868b',
                lineHeight: 1.45,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
              }}>
                在左侧预览上拖动选区移动；拖动角点或边调整大小；在深色遮罩上按下拖动可框选新的裁切范围。
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default EditorControls
