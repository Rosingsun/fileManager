import React from 'react'
import { Button, InputNumber } from 'antd'
import { ScissorOutlined } from '@ant-design/icons'
import { SectionTitle } from './editorControlPrimitives'
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

const MIN_CROP_DIM = 20

interface EditorCropPanelProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
  showCropMode?: boolean
  onToggleCropMode?: (show: boolean) => void
  imageWidth?: number
  imageHeight?: number
}

const EditorCropPanel: React.FC<EditorCropPanelProps> = ({
  settings,
  onChange,
  showCropMode,
  onToggleCropMode,
  imageWidth = 800,
  imageHeight = 600,
}) => {
  const clampCropRect = (rect: NonNullable<ImageEditSettings['crop']>): NonNullable<ImageEditSettings['crop']> => {
    let { x, y, width, height } = rect
    width = Math.max(MIN_CROP_DIM, Math.min(width, imageWidth))
    height = Math.max(MIN_CROP_DIM, Math.min(height, imageHeight))
    x = Math.max(0, Math.min(x, imageWidth - MIN_CROP_DIM))
    y = Math.max(0, Math.min(y, imageHeight - MIN_CROP_DIM))
    width = Math.min(width, imageWidth - x)
    height = Math.min(height, imageHeight - y)
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(Math.max(MIN_CROP_DIM, width)),
      height: Math.round(Math.max(MIN_CROP_DIM, height)),
    }
  }

  const handleCropChange = (field: keyof NonNullable<ImageEditSettings['crop']>) => (value: number | null) => {
    const base = settings.crop ?? { x: 0, y: 0, width: imageWidth, height: imageHeight }
    onChange({ crop: clampCropRect({ ...base, [field]: value ?? 0 }) })
  }

  return (
    <div className="image-editor-controls-panel editor-panel-body">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0' }}>
        <SectionTitle icon={<ScissorOutlined />}>裁切</SectionTitle>
        <Button size="small" type={showCropMode ? 'primary' : 'default'} onClick={() => onToggleCropMode?.(!showCropMode)}>
          {showCropMode ? '关闭' : '开启'}
        </Button>
      </div>

      {showCropMode && (
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <Button size="small" type={!settings.crop ? 'primary' : 'default'} onClick={() => onChange({ crop: undefined })}>
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
              >
                {preset.label}
              </Button>
            ))}
          </div>
          {!settings.crop && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {(['x', 'y', 'width', 'height'] as const).map(field => (
                <div key={field}>
                  <div style={{ fontSize: 11, color: 'var(--app-text-secondary)', marginBottom: 4 }}>
                    {field === 'x' ? 'X' : field === 'y' ? 'Y' : field === 'width' ? '宽度' : '高度'}
                  </div>
                  <InputNumber
                    value={field === 'width' ? imageWidth : field === 'height' ? imageHeight : 0}
                    onChange={handleCropChange(field)}
                    min={field === 'x' || field === 'y' ? 0 : MIN_CROP_DIM}
                    max={field === 'width' ? imageWidth : field === 'height' ? imageHeight : Math.max(0, (field === 'x' ? imageWidth : imageHeight) - MIN_CROP_DIM)}
                    size="small"
                    style={{ width: '100%' }}
                  />
                </div>
              ))}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 11, color: 'var(--app-text-secondary)', lineHeight: 1.45 }}>
            在预览区拖动选区移动；拖动角点调整大小；在遮罩上拖动可框选新范围。
          </p>
        </div>
      )}
    </div>
  )
}

export default EditorCropPanel
