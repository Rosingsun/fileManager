import React from 'react'
import { Button, Switch } from 'antd'
import {
  TbRotate2,
  TbRotateClockwise2,
  TbFlipHorizontal,
  TbFlipVertical,
} from '../icons'
import { ControlRow, PanelSection } from './editorControlPrimitives'
import { numSetting, resetEditPanel } from '../../utils'
import type { ImageEditSettings } from '../../types'

interface EditorGeometryPanelProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
}

const EditorGeometryPanel: React.FC<EditorGeometryPanelProps> = ({ settings, onChange }) => {
  const rotation = numSetting(settings, 'rotation', 0)

  const rotateBy = (delta: number) => {
    onChange({ rotation: (rotation + delta + 360) % 360 })
  }

  return (
    <div className="image-editor-controls-panel editor-panel-body">
      <PanelSection title="旋转" onReset={() => onChange(resetEditPanel('transform'))}>
        <div className="editor-geometry-actions">
          <Button
            type="default"
            size="small"
            icon={<TbRotate2 size={18} />}
            onClick={() => rotateBy(-90)}
            aria-label="左旋 90 度"
          >
            左旋 90°
          </Button>
          <Button
            type="default"
            size="small"
            icon={<TbRotateClockwise2 size={18} />}
            onClick={() => rotateBy(90)}
            aria-label="右旋 90 度"
          >
            右旋 90°
          </Button>
          <Button type="default" size="small" onClick={() => rotateBy(180)}>
            180°
          </Button>
        </div>
        <ControlRow
          label="角度"
          value={rotation}
          defaultValue={0}
          min={0}
          max={360}
          onChange={v => onChange({ rotation: v })}
          unit="°"
        />
      </PanelSection>

      <PanelSection title="翻转">
        <div className="editor-geometry-flip-row">
          <div className="editor-geometry-flip-item">
            <TbFlipHorizontal size={18} aria-hidden />
            <span>水平翻转</span>
            <Switch
              checked={!!settings.flipHorizontal}
              onChange={c => onChange({ flipHorizontal: c })}
              size="small"
            />
          </div>
          <div className="editor-geometry-flip-item">
            <TbFlipVertical size={18} aria-hidden />
            <span>垂直翻转</span>
            <Switch
              checked={!!settings.flipVertical}
              onChange={c => onChange({ flipVertical: c })}
              size="small"
            />
          </div>
        </div>
      </PanelSection>
    </div>
  )
}

export default EditorGeometryPanel
