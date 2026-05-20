import React from 'react'
import {
  TbAdjustments,
  TbPalette,
  TbSparkles,
  TbCrop,
} from '../icons'
import type { IconType } from '../icons'

export type EditorToolKey = 'adjust' | 'color' | 'effects' | 'crop'

interface SegmentItem {
  key: EditorToolKey
  label: string
  Icon: IconType
}

const SEGMENTS: SegmentItem[] = [
  { key: 'adjust', label: '调整', Icon: TbAdjustments },
  { key: 'color', label: '色彩', Icon: TbPalette },
  { key: 'effects', label: '滤镜', Icon: TbSparkles },
  { key: 'crop', label: '裁切', Icon: TbCrop },
]

interface EditorSegmentNavProps {
  active: EditorToolKey
  onChange: (key: EditorToolKey) => void
}

const EditorSegmentNav: React.FC<EditorSegmentNavProps> = ({ active, onChange }) => (
  <nav className="editor-segment-nav" role="tablist" aria-label="编辑工具">
    {SEGMENTS.map(({ key, label, Icon }) => {
      const isActive = active === key
      return (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={isActive}
          className={`editor-segment-nav__item${isActive ? ' is-active' : ''}`}
          onClick={() => onChange(key)}
        >
          <Icon size={16} aria-hidden />
          <span>{label}</span>
        </button>
      )
    })}
  </nav>
)

export default EditorSegmentNav
