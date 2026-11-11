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
  const crop = settings.crop ?? { x: 0, y: 0, width: imageWidth, height: imageHeight }

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
    onChange({ crop: clampCropRect({ ...crop, [field]: value ?? 0 }) })
  }

  const handleAspect = (w: number, h: number) => {
    onChange({ crop: computeCropRectForAspectRatio(imageWidth, imageHeight, w, h) })
  }

  return (
    <div className="image-editor-controls-panel editor-panel-body">
      <div className="editor-crop-head">
        <SectionTitle icon={<ScissorOutlined />}>裁切</SectionTitle>
        <Button
          size="small"
          type={showCropMode ? 'primary' : 'default'}
          onClick={() => onToggleCropMode?.(!showCropMode)}
        >
          {showCropMode ? '关闭遮罩' : '开启遮罩'}
        </Button>
      </div>

      <div className="editor-crop-body">
        <div className="editor-crop-aspects">
          <Button
            size="small"
            type={!settings.crop ? 'primary' : 'default'}
            onClick={() => onChange({ crop: undefined })}
          >
            自由
          </Button>
          {CROP_ASPECT_PRESETS.map(preset => (
            <Button
              key={`${preset.w}-${preset.h}`}
              size="small"
              onClick={() => handleAspect(preset.w, preset.h)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="editor-crop-fields">
          {(['x', 'y', 'width', 'height'] as const).map(field => (
            <label key={field} className="editor-crop-field">
              <span className="editor-crop-field__label">
                {field === 'x' ? 'X' : field === 'y' ? 'Y' : field === 'width' ? '宽度' : '高度'}
              </span>
              <InputNumber
                value={crop[field]}
                onChange={handleCropChange(field)}
                min={field === 'x' || field === 'y' ? 0 : MIN_CROP_DIM}
                max={
                  field === 'x'
                    ? Math.max(0, imageWidth - MIN_CROP_DIM)
                    : field === 'y'
                      ? Math.max(0, imageHeight - MIN_CROP_DIM)
                      : field === 'width'
                        ? imageWidth
                        : imageHeight
                }
                size="small"
                style={{ width: '100%' }}
              />
            </label>
          ))}
        </div>

        <div className="editor-crop-summary">
          <span>
            {crop.width} × {crop.height} px
          </span>
          {settings.crop ? (
            <Button type="text" size="small" onClick={() => onChange({ crop: undefined })}>
              恢复整图
            </Button>
          ) : null}
        </div>

        <p className="editor-crop-hint">
          {showCropMode
            ? '在预览区拖动选区移动；拖动角点调整大小；在遮罩上拖动可框选新范围。'
            : '开启遮罩后可在预览区直接拖拽裁切框。'}
        </p>
      </div>
    </div>
  )
}

export default EditorCropPanel
