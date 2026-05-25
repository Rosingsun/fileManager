import React, { useCallback, useState } from 'react'
import { Button, Tooltip } from 'antd'
import {
  TbLayoutSidebarRightCollapse,
  TbLayoutSidebarRightExpand,
  TbChevronDown,
  TbChevronUp,
} from '../icons'
import EditorSegmentNav, { type EditorToolKey } from './EditorSegmentNav'
import EditorAdjustPanel from './EditorAdjustPanel'
import EditorColorPanel from './EditorColorPanel'
import EditorCurvesPanel from './EditorCurvesPanel'
import EditorGeometryPanel from './EditorGeometryPanel'
import EditorEffectsPanel from './EditorEffectsPanel'
import EditorCropPanel from './EditorCropPanel'
import PresetsPanel from './PresetsPanel'
import { resetEditPanel, countActiveEdits } from '../../utils'
import type { EditPanelGroup } from '../../utils'
import type { ImageEditSettings } from '../../types'

const PRESETS_COLLAPSED_KEY = 'filedeal_editor_presets_collapsed'

function readPresetsCollapsed(): boolean {
  try {
    return localStorage.getItem(PRESETS_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

const TOOL_RESET_GROUP: Record<EditorToolKey, EditPanelGroup> = {
  adjust: 'adjust',
  color: 'color',
  curves: 'curves',
  geometry: 'transform',
  effects: 'effects',
  crop: 'transform',
}

interface EditorSidebarProps {
  settings: ImageEditSettings
  onChange: (updates: Partial<ImageEditSettings>) => void
  onApplyPreset: (settings: ImageEditSettings) => void
  previewSrc: string | null
  settingsDigest: string
  showCropMode?: boolean
  onToggleCropMode?: (show: boolean) => void
  imageWidth?: number
  imageHeight?: number
  onAutoEnhance?: () => void
  autoEnhanceLoading?: boolean
  filePath?: string
  onPickWhiteBalance?: () => void
  pickWhiteBalanceActive?: boolean
}

const EditorSidebar: React.FC<EditorSidebarProps> = ({
  settings,
  onChange,
  onApplyPreset,
  previewSrc,
  settingsDigest,
  showCropMode,
  onToggleCropMode,
  imageWidth,
  imageHeight,
  onAutoEnhance,
  autoEnhanceLoading,
  filePath,
  onPickWhiteBalance,
  pickWhiteBalanceActive,
}) => {
  const imagePixelCount = (imageWidth ?? 0) * (imageHeight ?? 0)
  const [collapsed, setCollapsed] = useState(false)
  const [presetsCollapsed, setPresetsCollapsed] = useState(readPresetsCollapsed)
  const [activeTool, setActiveTool] = useState<EditorToolKey>('adjust')

  const togglePresetsCollapsed = useCallback(() => {
    setPresetsCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem(PRESETS_COLLAPSED_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const handleToolChange = (key: EditorToolKey) => {
    setActiveTool(key)
    if (key === 'crop') {
      onToggleCropMode?.(true)
    }
  }

  const renderToolPanel = () => {
    switch (activeTool) {
      case 'color':
        return (
          <EditorColorPanel
            settings={settings}
            onChange={onChange}
            onPickWhiteBalance={onPickWhiteBalance}
            pickWhiteBalanceActive={pickWhiteBalanceActive}
          />
        )
      case 'curves':
        return (
          <EditorCurvesPanel
            settings={settings}
            onChange={onChange}
            previewSrc={previewSrc}
            settingsDigest={settingsDigest}
            filePath={filePath}
            imagePixelCount={imagePixelCount}
          />
        )
      case 'geometry':
        return <EditorGeometryPanel settings={settings} onChange={onChange} />
      case 'effects':
        return <EditorEffectsPanel settings={settings} onChange={onChange} />
      case 'crop':
        return (
          <EditorCropPanel
            settings={settings}
            onChange={onChange}
            showCropMode={showCropMode}
            onToggleCropMode={onToggleCropMode}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
          />
        )
      case 'adjust':
      default:
        return (
          <EditorAdjustPanel
            settings={settings}
            onChange={onChange}
            previewSrc={previewSrc}
            settingsDigest={settingsDigest}
            filePath={filePath}
            imagePixelCount={imagePixelCount}
            onAutoEnhance={onAutoEnhance}
            autoEnhanceLoading={autoEnhanceLoading}
          />
        )
    }
  }

  return (
    <aside className={`image-editor-sidebar${collapsed ? ' is-collapsed' : ''}`}>
      <header className="image-editor-sidebar__header">
        {!collapsed && (
          <div className="image-editor-sidebar__brand-wrap">
            <span className="image-editor-sidebar__brand">调整</span>
            {countActiveEdits(settings) > 0 && (
              <span className="image-editor-sidebar__badge">{countActiveEdits(settings)}</span>
            )}
          </div>
        )}
        <Tooltip title={collapsed ? '展开面板' : '收起面板'}>
          <Button
            type="text"
            size="small"
            className="image-editor-sidebar__collapse-btn"
            icon={
              collapsed ? (
                <TbLayoutSidebarRightExpand size={18} />
              ) : (
                <TbLayoutSidebarRightCollapse size={18} />
              )
            }
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? '展开编辑面板' : '收起编辑面板'}
          />
        </Tooltip>
      </header>

      {!collapsed && (
        <>
          <section
            className={`image-editor-sidebar__presets-zone${presetsCollapsed ? ' is-presets-collapsed' : ''}`}
            aria-label="预设"
          >
            <div className="image-editor-sidebar__presets-head">
              <span className="image-editor-sidebar__presets-title">预设</span>
              <Tooltip title={presetsCollapsed ? '展开预设' : '收起预设'}>
                <Button
                  type="text"
                  size="small"
                  className="image-editor-sidebar__presets-toggle"
                  icon={presetsCollapsed ? <TbChevronDown size={16} /> : <TbChevronUp size={16} />}
                  onClick={togglePresetsCollapsed}
                  aria-label={presetsCollapsed ? '展开预设区' : '收起预设区'}
                  aria-expanded={!presetsCollapsed}
                />
              </Tooltip>
            </div>
            {!presetsCollapsed ? (
              <PresetsPanel
                layout="sidebar"
                onApply={onApplyPreset}
                currentSettings={settings}
                hideHeading
              />
            ) : null}
          </section>

          <section className="image-editor-sidebar__tools-zone" aria-label="编辑工具">
            <div className="image-editor-sidebar__tools-head">
              <EditorSegmentNav active={activeTool} onChange={handleToolChange} />
              <Button
                type="text"
                size="small"
                className="image-editor-sidebar__panel-reset"
                onClick={() => onChange(resetEditPanel(TOOL_RESET_GROUP[activeTool]))}
              >
                重置本页
              </Button>
            </div>
            <div className="image-editor-sidebar__panel-scroll">{renderToolPanel()}</div>
          </section>
        </>
      )}
    </aside>
  )
}

export default EditorSidebar
