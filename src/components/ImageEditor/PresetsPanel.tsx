import React, { useState, useMemo } from 'react'
import { List, Button, Input, Space, message, Popconfirm, Select, Modal, Divider } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, ThunderboltOutlined, FolderOutlined } from '@ant-design/icons'
import { useImageEditorStore } from '../../stores'
import type { ImageEditSettings, ImagePreset } from '../../types'

interface PresetsPanelProps {
  onApply: (settings: ImageEditSettings) => void
  currentSettings: ImageEditSettings
}

const BUILTIN_PRESETS: { name: string; settings: ImageEditSettings }[] = [
  { name: '默认', settings: {} },
  { name: '明亮', settings: { brightness: 120, contrast: 110 } },
  { name: '柔和', settings: { brightness: 105, contrast: 90, saturation: 85 } },
  { name: '鲜艳', settings: { saturation: 140, contrast: 115 } },
  { name: '复古', settings: { vintage: 60, saturation: 80, contrast: 105 } },
  { name: '黑白', settings: { grayscale: true } },
  { name: '清冷', settings: { hue: 200, saturation: 90, brightness: 105 } },
  { name: '暖阳', settings: { hue: 30, saturation: 120, brightness: 115 } },
]

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

  const isSystemGroup = selectedGroupId === 'system'

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

  const editableGroups = useMemo(() => 
    groups.filter(g => !g.isBuiltIn || g.id === 'system'),
  [groups])

  const handleAddPreset = () => {
    setSavePresetName('')
    setSavePresetGroup(selectedGroupId)
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
    return (
      <List.Item
        key={item.id}
        style={{ 
          padding: '4px 8px',
          margin: '2px 0',
          borderRadius: 6,
          background: isSelected ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
          border: isSelected ? '1px solid rgba(24, 144, 255, 0.3)' : '1px solid transparent',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onClick={handleClick}
        actions={[
          editingId === item.id ? (
            <>
              <Button type="text" size="small" icon={<CheckOutlined />} onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }} />
              <Button type="text" size="small" onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}>取消</Button>
            </>
          ) : isSelected ? (
            <>
              <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); handleUpdatePreset(); }} style={{ padding: '2px 6px' }}>更新</Button>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleStartEdit(item.id, item.name); }} style={{ padding: '2px' }} />
              <Popconfirm title="确认删除？" onConfirm={(e) => { e?.stopPropagation(); handleDeletePreset(item.id); }} okText="删除" cancelText="取消">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} style={{ padding: '2px' }} />
              </Popconfirm>
            </>
          ) : (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleStartEdit(item.id, item.name); }} style={{ padding: '2px' }} />
              <Popconfirm title="确认删除？" onConfirm={(e) => { e?.stopPropagation(); handleDeletePreset(item.id); }} okText="删除" cancelText="取消">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} style={{ padding: '2px' }} />
              </Popconfirm>
            </>
          )
        ]}
      >
        {editingId === item.id ? (
          <Input value={editingName} onChange={e => setEditingName(e.target.value)} size="small" style={{ width: 80 }} onPressEnter={handleSaveEdit} autoFocus onClick={e => e.stopPropagation()} />
        ) : (
          <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#1890ff' : 'inherit' }}>{item.name}</span>
        )}
      </List.Item>
    )
  }

  const renderBuiltinPresetItem = (preset: { name: string; settings: ImageEditSettings }, idx: number) => {
    const builtinId = `builtin-${preset.name}`
    const isSelected = selectedPresetId === builtinId
    const handleClick = () => {
      onApply(preset.settings)
      setSelectedPreset(builtinId)
    }
    return (
      <List.Item
        key={`builtin-${idx}`}
        style={{ 
          padding: '4px 8px',
          margin: '2px 0',
          borderRadius: 6,
          background: isSelected ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
          border: isSelected ? '1px solid rgba(24, 144, 255, 0.3)' : '1px solid transparent',
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onClick={handleClick}
      >
        <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#1890ff' : 'inherit' }}>{preset.name}</span>
      </List.Item>
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
            label: g.isBuiltIn ? (
              <span>
                <ThunderboltOutlined style={{ marginRight: 4 }} />
                {g.name}
              </span>
            ) : g.name
          }))}
          size="small"
        />
        {!isSystemGroup && (
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
        {isSystemGroup ? (
          <><ThunderboltOutlined style={{ marginRight: 4 }} />系统预设 共 {BUILTIN_PRESETS.length} 个</>
        ) : (
          <><FolderOutlined style={{ marginRight: 4 }} />{currentGroup?.name || '预设'} 共 {filteredPresets.length} 个</>
        )}
      </div>
      
      <List
        size="small"
        dataSource={isSystemGroup ? BUILTIN_PRESETS : filteredPresets}
        locale={{ emptyText: isSystemGroup ? '' : '暂无预设，点击上方新增预设' }}
        style={{ maxHeight: 160, overflow: 'auto' }}
        renderItem={(item: any, index: number) => isSystemGroup ? renderBuiltinPresetItem(item, index) : renderPresetItem(item)}
      />

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
              options={groups.filter(g => !g.isBuiltIn || g.id === 'system').map(g => ({
                value: g.id,
                label: g.isBuiltIn ? (
                  <span><ThunderboltOutlined style={{ marginRight: 4 }} />{g.name}</span>
                ) : g.name
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
