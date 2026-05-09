import React, { useState, useMemo } from 'react'
import { Button, Input, Space, message, Popconfirm, Select, Modal, Divider } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  ThunderboltOutlined,
  FolderOutlined,
  CameraOutlined,
  PictureOutlined,
  AimOutlined,
  PlayCircleOutlined,
  SunOutlined,
  ScanOutlined,
  BorderOuterOutlined,
} from '@ant-design/icons'
import { useImageEditorStore, isBuiltinPresetCollectionGroup } from '../../stores'
import type { ImageEditSettings, ImagePreset, PresetGroup } from '../../types'

interface PresetsPanelProps {
  onApply: (settings: ImageEditSettings) => void
  currentSettings: ImageEditSettings
}

/** 通用系统预设（非富士胶片模拟） */
const BUILTIN_SYSTEM_PRESETS: { name: string; settings: ImageEditSettings }[] = [
  { name: '默认', settings: {} },
  { name: '明亮', settings: { brightness: 120, contrast: 110 } },
  { name: '柔和', settings: { brightness: 105, contrast: 90, saturation: 85 } },
  { name: '鲜艳', settings: { saturation: 140, contrast: 115 } },
  { name: '复古', settings: { vintage: 60, saturation: 80, contrast: 105 } },
  { name: '黑白', settings: { grayscale: true } },
  { name: '清冷', settings: { hue: 200, saturation: 90, brightness: 105 } },
  { name: '暖阳', settings: { hue: 30, saturation: 120, brightness: 115 } },
]

/** 富士胶片模拟近似（非机身曲线）；参数与预览 CSS / Sharp 一致 */
const BUILTIN_FUJI_PRESETS: { name: string; settings: ImageEditSettings }[] = [
  { name: 'Provia 标准', settings: { saturation: 108, contrast: 104, brightness: 100 } },
  { name: 'Velvia 鲜艳', settings: { saturation: 138, contrast: 118, brightness: 98 } },
  { name: 'Astia 柔和', settings: { saturation: 94, contrast: 94, brightness: 106 } },
  { name: 'CC 经典正片', settings: { saturation: 88, contrast: 112, brightness: 98, hue: 352, vintage: 12 } },
  { name: 'NC 经典负片', settings: { saturation: 93, contrast: 114, brightness: 99, hue: 10, vintage: 20 } },
  { name: 'Eterna 电影', settings: { saturation: 84, contrast: 92, brightness: 106, vintage: 8 } },
  { name: 'Eterna 漂白', settings: { saturation: 78, contrast: 122, brightness: 110, vintage: 14 } },
  { name: 'Acros', settings: { grayscale: true, contrast: 116, brightness: 98 } },
  { name: 'Pro Neg Hi', settings: { saturation: 100, contrast: 108, brightness: 101 } },
  { name: 'Pro Neg Std', settings: { saturation: 96, contrast: 100, brightness: 103 } },
  { name: '漂白效果', settings: { saturation: 72, contrast: 118, brightness: 108, vintage: 18 } },
  { name: '怀旧琥珀', settings: { saturation: 90, contrast: 106, brightness: 102, hue: 25, vintage: 35 } },
  { name: 'NN 怀旧负片', settings: { saturation: 96, contrast: 105, brightness: 104, hue: 18, vintage: 28 } },
]

/** 佳能风格近似（暖调人像 / Picture Style 取向） */
const BUILTIN_CANON_PRESETS: { name: string; settings: ImageEditSettings }[] = [
  { name: '标准清晰', settings: { saturation: 102, contrast: 104, brightness: 100 } },
  { name: '人像肤色', settings: { saturation: 105, contrast: 98, brightness: 103, hue: 8 } },
  { name: '风光鲜艳', settings: { saturation: 118, contrast: 108, brightness: 99 } },
  { name: '中性可靠', settings: { saturation: 98, contrast: 102, brightness: 101 } },
  { name: '电影暗调', settings: { saturation: 92, contrast: 112, brightness: 96, vintage: 15 } },
  { name: '黑白分明', settings: { grayscale: true, contrast: 110 } },
  { name: '日系清透', settings: { saturation: 96, contrast: 96, brightness: 106 } },
]

/** 尼康风格近似（层次 / 鲜艳取向） */
const BUILTIN_NIKON_PRESETS: { name: string; settings: ImageEditSettings }[] = [
  { name: '标准', settings: { saturation: 104, contrast: 106, brightness: 100 } },
  { name: '鲜艳优化', settings: { saturation: 122, contrast: 114, brightness: 98 } },
  { name: '人像柔肤', settings: { saturation: 98, contrast: 100, brightness: 104 } },
  { name: '风景层次', settings: { saturation: 108, contrast: 116, brightness: 98 } },
  { name: '黄昏金调', settings: { saturation: 110, contrast: 104, brightness: 102, hue: 20 } },
  { name: '黑白反差', settings: { grayscale: true, contrast: 118 } },
  { name: '硬朗清晰', settings: { saturation: 100, contrast: 112, brightness: 99 } },
]

/** 索尼风格近似（创意风格 / 冷暖取向） */
const BUILTIN_SONY_PRESETS: { name: string; settings: ImageEditSettings }[] = [
  { name: '生动', settings: { saturation: 118, contrast: 108, brightness: 100 } },
  { name: '肖像', settings: { saturation: 102, contrast: 98, brightness: 104 } },
  { name: '日落暖色', settings: { saturation: 112, contrast: 106, brightness: 101, hue: 15 } },
  { name: '夜景冷调', settings: { saturation: 94, contrast: 108, brightness: 94, hue: 220 } },
  { name: '褪色胶片', settings: { saturation: 88, contrast: 102, brightness: 104, vintage: 22 } },
  { name: '黑白清晰', settings: { grayscale: true, contrast: 112 } },
  { name: '中性写实', settings: { saturation: 100, contrast: 104, brightness: 100 } },
]

/** 柯达胶卷色调近似 */
const BUILTIN_KODAK_PRESETS: { name: string; settings: ImageEditSettings }[] = [
  { name: '金灿日光', settings: { saturation: 108, contrast: 104, brightness: 105, hue: 28, vintage: 18 } },
  { name: '炮塔柔和', settings: { saturation: 96, contrast: 96, brightness: 104 } },
  { name: 'Ektar 饱和', settings: { saturation: 128, contrast: 112, brightness: 99 } },
  { name: 'Tri-X 黑白', settings: { grayscale: true, contrast: 114, brightness: 98 } },
  { name: '复古褪色', settings: { saturation: 85, contrast: 104, brightness: 106, vintage: 38 } },
  { name: '童话暖黄', settings: { saturation: 102, contrast: 100, brightness: 108, hue: 35 } },
  { name: '街头纪实', settings: { saturation: 104, contrast: 110, brightness: 99, vintage: 12 } },
]

/** 徕卡色彩近似（中性 / 反差取向） */
const BUILTIN_LEICA_PRESETS: { name: string; settings: ImageEditSettings }[] = [
  { name: '自然中性', settings: { saturation: 100, contrast: 102, brightness: 100 } },
  { name: '鲜明细腻', settings: { saturation: 106, contrast: 106, brightness: 99 } },
  { name: '单色低调', settings: { grayscale: true, contrast: 108, brightness: 102 } },
  { name: '胶片柔和', settings: { saturation: 94, contrast: 98, brightness: 104, vintage: 14 } },
  { name: '街头冷调', settings: { saturation: 96, contrast: 108, brightness: 98, hue: 340 } },
  { name: '暖调人文', settings: { saturation: 102, contrast: 104, brightness: 102, hue: 12 } },
]

/** 宝丽来即时成像近似 */
const BUILTIN_POLAROID_PRESETS: { name: string; settings: ImageEditSettings }[] = [
  { name: 'SX-70 经典', settings: { saturation: 95, contrast: 96, brightness: 106, vintage: 25 } },
  { name: '600 饱和', settings: { saturation: 118, contrast: 104, brightness: 102 } },
  { name: '褪色蓝绿', settings: { saturation: 82, contrast: 98, brightness: 108, hue: 185 } },
  { name: '黑白艺术', settings: { grayscale: true, contrast: 104, brightness: 105 } },
  { name: '过曝梦幻', settings: { saturation: 88, contrast: 94, brightness: 118, vintage: 20 } },
  { name: '即时褪色', settings: { saturation: 90, contrast: 100, brightness: 110, vintage: 32 } },
]

const BUILTIN_PRESETS_BY_GROUP: Record<string, { name: string; settings: ImageEditSettings }[]> = {
  system: BUILTIN_SYSTEM_PRESETS,
  fuji: BUILTIN_FUJI_PRESETS,
  canon: BUILTIN_CANON_PRESETS,
  nikon: BUILTIN_NIKON_PRESETS,
  sony: BUILTIN_SONY_PRESETS,
  kodak: BUILTIN_KODAK_PRESETS,
  leica: BUILTIN_LEICA_PRESETS,
  polaroid: BUILTIN_POLAROID_PRESETS,
}

const BUILTIN_SECTION_TITLE: Record<string, string> = {
  system: '系统预设',
  fuji: '富士胶片模拟',
  canon: '佳能 Picture Style 近似',
  nikon: '尼康优化校准近似',
  sony: '索尼创意风格近似',
  kodak: '柯达胶卷色调近似',
  leica: '徕卡色彩近似',
  polaroid: '宝丽来即时成像近似',
}

const GROUP_SELECT_ICON_GAP = 4

function renderBuiltinGroupOptionLabel(g: PresetGroup): React.ReactNode {
  const gap = GROUP_SELECT_ICON_GAP
  const wrap = (node: React.ReactNode) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      {node}
      <span>{g.name}</span>
    </span>
  )
  switch (g.id) {
    case 'system':
      return wrap(<ThunderboltOutlined />)
    case 'fuji':
      return wrap(<CameraOutlined />)
    case 'canon':
      return wrap(<PictureOutlined />)
    case 'nikon':
      return wrap(<AimOutlined />)
    case 'sony':
      return wrap(<PlayCircleOutlined />)
    case 'kodak':
      return wrap(<SunOutlined />)
    case 'leica':
      return wrap(<ScanOutlined />)
    case 'polaroid':
      return wrap(<BorderOuterOutlined />)
    default:
      return g.name
  }
}

function builtinSectionHeadingIcon(groupId: string): React.ReactNode {
  switch (groupId) {
    case 'system':
      return <ThunderboltOutlined style={{ marginRight: 4 }} />
    case 'fuji':
      return <CameraOutlined style={{ marginRight: 4 }} />
    case 'canon':
      return <PictureOutlined style={{ marginRight: 4 }} />
    case 'nikon':
      return <AimOutlined style={{ marginRight: 4 }} />
    case 'sony':
      return <PlayCircleOutlined style={{ marginRight: 4 }} />
    case 'kodak':
      return <SunOutlined style={{ marginRight: 4 }} />
    case 'leica':
      return <ScanOutlined style={{ marginRight: 4 }} />
    case 'polaroid':
      return <BorderOuterOutlined style={{ marginRight: 4 }} />
    default:
      return null
  }
}

const PRESET_GRID_SCROLL: React.CSSProperties = {
  maxHeight: 160,
  overflow: 'auto',
  paddingRight: 2,
}

const presetGridStyle = (columns: number): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  gap: 6,
  alignItems: 'start',
})

/** 自定义预设含名称与操作按钮，列宽不足时 auto-fill 自动减少列数，避免按钮竖排折断 */
const USER_PRESET_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
  gap: 6,
  alignItems: 'stretch',
}

const presetActionsRow: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: 2,
  flexShrink: 0,
}

const PresetsPanel: React.FC<PresetsPanelProps> = ({ onApply, currentSettings }) => {
  const { 
    presets, 
    groups, 
    selectedGroupId,
    selectedPresetId,
    addPreset, 
    updatePreset, 
    deletePreset,
    addGroup,
    updateGroup,
    deleteGroup,
    setSelectedGroup,
    setSelectedPreset
  } = useImageEditorStore()
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [saveModalVisible, setSaveModalVisible] = useState(false)
  const [savePresetName, setSavePresetName] = useState('')
  const [savePresetGroup, setSavePresetGroup] = useState('')
  const [addGroupModalVisible, setAddGroupModalVisible] = useState(false)
  const [addGroupName, setAddGroupName] = useState('')

  const currentGroup = useMemo(() => 
    groups.find(g => g.id === selectedGroupId), 
  [groups, selectedGroupId])

  const handleUpdatePreset = () => {
    if (!selectedPresetId) {
      message.warning('请先选择一个预设')
      return
    }
    updatePreset(selectedPresetId, { settings: currentSettings })
    message.success('预设已更新')
  }

  const filteredPresets = useMemo(() => {
    return presets.filter(p => p.groupId === selectedGroupId || (!p.groupId && selectedGroupId === 'ungrouped'))
  }, [presets, selectedGroupId])

  const editableGroups = useMemo(
    () => groups.filter(g => !g.isBuiltIn),
    [groups]
  )

  const handleAddPreset = () => {
    setSavePresetName('')
    setSavePresetGroup(
      isBuiltinPresetCollectionGroup(selectedGroupId) ? 'ungrouped' : selectedGroupId
    )
    setSaveModalVisible(true)
  }

  const handleSavePreset = () => {
    if (!savePresetName.trim()) {
      message.error('名称不能为空')
      return
    }
    if (!savePresetGroup) {
      message.error('请选择分组')
      return
    }
    addPreset({ 
      name: savePresetName.trim(), 
      settings: currentSettings,
      groupId: savePresetGroup
    })
    setSaveModalVisible(false)
    if (savePresetGroup !== selectedGroupId) {
      setSelectedGroup(savePresetGroup)
    }
    message.success('预设已保存')
  }

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id)
    setEditingName(name)
  }

  const handleSaveEdit = () => {
    if (!editingName.trim()) {
      message.error('名称不能为空')
      return
    }
    if (editingId) {
      updatePreset(editingId, { name: editingName.trim() })
      message.success('预设已更新')
    }
    setEditingId(null)
    setEditingName('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleDeletePreset = (id: string) => {
    deletePreset(id)
    message.success('预设已删除')
  }

  const handleAddGroup = () => {
    setAddGroupName('')
    setAddGroupModalVisible(true)
  }

  const handleSaveNewGroup = () => {
    if (!addGroupName.trim()) {
      message.error('分组名称不能为空')
      return
    }
    addGroup({ name: addGroupName.trim() })
    setAddGroupModalVisible(false)
    message.success('分组已添加')
  }

  const handleStartEditGroup = (id: string, name: string) => {
    setEditingGroupId(id)
    setEditingGroupName(name)
  }

  const handleSaveEditGroup = () => {
    if (!editingGroupName.trim()) {
      message.error('分组名称不能为空')
      return
    }
    if (editingGroupId) {
      updateGroup(editingGroupId, { name: editingGroupName.trim() })
      message.success('分组已更新')
    }
    setEditingGroupId(null)
    setEditingGroupName('')
  }

  const handleCancelEditGroup = () => {
    setEditingGroupId(null)
    setEditingGroupName('')
  }

  const handleDeleteGroup = (id: string) => {
    deleteGroup(id)
    message.success('分组已删除')
  }

  const renderPresetItem = (item: ImagePreset) => {
    const isSelected = selectedPresetId === item.id
    const handleClick = () => {
      onApply(item.settings)
      setSelectedPreset(item.id)
    }
    const cellStyle: React.CSSProperties = {
      padding: '6px 8px',
      borderRadius: 6,
      background: isSelected ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
      border: isSelected ? '1px solid rgba(24, 144, 255, 0.3)' : '1px solid transparent',
      transition: 'all 0.2s ease',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      overflow: 'hidden',
    }
    return (
      <div key={item.id} style={cellStyle}>
        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleClick()
            }
          }}
          style={{
            cursor: 'pointer',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: editingId === item.id ? 'normal' : 'nowrap',
          }}
        >
          {editingId === item.id ? (
            <Input value={editingName} onChange={e => setEditingName(e.target.value)} size="small" style={{ width: '100%' }} onPressEnter={handleSaveEdit} autoFocus onClick={e => e.stopPropagation()} />
          ) : (
            <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#1890ff' : 'inherit' }}>{item.name}</span>
          )}
        </div>
        <div style={presetActionsRow}>
          {editingId === item.id ? (
            <>
              <Button type="text" size="small" icon={<CheckOutlined />} onClick={e => { e.stopPropagation(); handleSaveEdit(); }} />
              <Button type="text" size="small" onClick={e => { e.stopPropagation(); handleCancelEdit(); }}>取消</Button>
            </>
          ) : isSelected ? (
            <>
              <Button type="link" size="small" onClick={e => { e.stopPropagation(); handleUpdatePreset(); }} style={{ padding: '0 4px', fontSize: 11 }}>更新</Button>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={e => { e.stopPropagation(); handleStartEdit(item.id, item.name); }} style={{ padding: '0 2px' }} />
              <Popconfirm title="确认删除？" onConfirm={e => { e?.stopPropagation(); handleDeletePreset(item.id); }} okText="删除" cancelText="取消">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} style={{ padding: '0 2px' }} />
              </Popconfirm>
            </>
          ) : (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={e => { e.stopPropagation(); handleStartEdit(item.id, item.name); }} style={{ padding: '0 2px' }} />
              <Popconfirm title="确认删除？" onConfirm={e => { e?.stopPropagation(); handleDeletePreset(item.id); }} okText="删除" cancelText="取消">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} style={{ padding: '0 2px' }} />
              </Popconfirm>
            </>
          )}
        </div>
      </div>
    )
  }

  const renderBuiltinPresetItem = (
    preset: { name: string; settings: ImageEditSettings },
    idx: number,
    builtinGroupId: string
  ) => {
    const builtinId = `builtin-${builtinGroupId}-${idx}`
    const isSelected = selectedPresetId === builtinId
    const handleClick = () => {
      onApply(preset.settings)
      setSelectedPreset(builtinId)
    }
    return (
      <div
        key={`builtin-${builtinGroupId}-${idx}`}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        style={{
          padding: '6px 8px',
          borderRadius: 6,
          background: isSelected ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
          border: isSelected ? '1px solid rgba(24, 144, 255, 0.3)' : '1px solid transparent',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          textAlign: 'center',
          minWidth: 0,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#1890ff' : 'inherit' }}>{preset.name}</span>
      </div>
    )
  }

  return (
    <div style={{ padding: 8, borderBottom: '1px solid rgba(0, 0, 0, 0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Select
          style={{ flex: 1 }}
          value={selectedGroupId}
          onChange={setSelectedGroup}
          options={groups.map(g => ({
            value: g.id,
            label: renderBuiltinGroupOptionLabel(g),
          }))}
          size="small"
        />
        {!isBuiltinPresetCollectionGroup(selectedGroupId) && (
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddPreset}>
            新增预设
          </Button>
        )}
        <Button size="small" icon={<PlusOutlined />} onClick={handleAddGroup}>
          新增分组
        </Button>
      </div>

      {editableGroups.map(group => (
        group.id === selectedGroupId && !group.isBuiltIn && (
          <div key={group.id} style={{ marginBottom: 8, padding: '4px 8px', background: 'rgba(0,0,0,0.02)', borderRadius: 4 }}>
            {editingGroupId === group.id ? (
              <Space>
                <Input 
                  value={editingGroupName} 
                  onChange={e => setEditingGroupName(e.target.value)} 
                  size="small" 
                  style={{ width: 80 }} 
                  onPressEnter={handleSaveEditGroup} 
                  autoFocus 
                />
                <Button type="text" size="small" icon={<CheckOutlined />} onClick={handleSaveEditGroup} />
                <Button type="text" size="small" onClick={handleCancelEditGroup}>取消</Button>
              </Space>
            ) : (
              <Space>
                <span style={{ fontSize: 11, color: '#666' }}>编辑分组:</span>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleStartEditGroup(group.id, group.name)} style={{ padding: '2px' }} />
                <Popconfirm title="确认删除此分组？预设将移至未分组" onConfirm={() => handleDeleteGroup(group.id)} okText="删除" cancelText="取消">
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} style={{ padding: '2px' }} />
                </Popconfirm>
              </Space>
            )}
          </div>
        )
      ))}

      <Divider style={{ margin: '8px 0' }} />

      <div style={{ 
        fontSize: 11, 
        fontWeight: 600,
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'
      }}>
        {isBuiltinPresetCollectionGroup(selectedGroupId) ? (
          <>
            {builtinSectionHeadingIcon(selectedGroupId)}
            {BUILTIN_SECTION_TITLE[selectedGroupId] ?? '内置预设'} 共{' '}
            {(BUILTIN_PRESETS_BY_GROUP[selectedGroupId] ?? []).length} 个
          </>
        ) : (
          <><FolderOutlined style={{ marginRight: 4 }} />{currentGroup?.name || '预设'} 共 {filteredPresets.length} 个</>
        )}
      </div>
      
      {isBuiltinPresetCollectionGroup(selectedGroupId) ? (
        <div style={PRESET_GRID_SCROLL}>
          <div style={presetGridStyle(4)}>
            {(BUILTIN_PRESETS_BY_GROUP[selectedGroupId] ?? []).map((p, i) =>
              renderBuiltinPresetItem(p, i, selectedGroupId)
            )}
          </div>
        </div>
      ) : filteredPresets.length === 0 ? (
        <div style={{ fontSize: 12, color: '#999', padding: '8px 0' }}>暂无预设，点击上方新增预设</div>
      ) : (
        <div style={PRESET_GRID_SCROLL}>
          <div style={USER_PRESET_GRID}>
            {filteredPresets.map(p => renderPresetItem(p))}
          </div>
        </div>
      )}

      <Modal
        title="保存预设"
        open={saveModalVisible}
        onOk={handleSavePreset}
        onCancel={() => setSaveModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={320}
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 12 }}>名称</div>
            <Input 
              placeholder="请输入预设名称" 
              value={savePresetName} 
              onChange={e => setSavePresetName(e.target.value)}
              onPressEnter={handleSavePreset}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>分组</div>
            <Select
              style={{ width: '100%' }}
              value={savePresetGroup}
              onChange={setSavePresetGroup}
              options={groups.filter(g => !g.isBuiltIn).map(g => ({
                value: g.id,
                label: g.name,
              }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title="新增分组"
        open={addGroupModalVisible}
        onOk={handleSaveNewGroup}
        onCancel={() => setAddGroupModalVisible(false)}
        okText="添加"
        cancelText="取消"
        width={300}
      >
        <div style={{ padding: '8px 0' }}>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>分组名称</div>
            <Input 
              placeholder="请输入分组名称" 
              value={addGroupName} 
              onChange={e => setAddGroupName(e.target.value)}
              onPressEnter={handleSaveNewGroup}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default PresetsPanel
