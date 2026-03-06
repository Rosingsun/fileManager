import React, { useState } from 'react'
import { List, Button, Input, Space, message } from 'antd'
import { useImageEditorStore } from '../../stores'
import type { ImageEditSettings } from '../../types'

interface PresetsPanelProps {
  onApply: (settings: ImageEditSettings) => void
  currentSettings: ImageEditSettings
}

const PresetsPanel: React.FC<PresetsPanelProps> = ({ onApply, currentSettings }) => {
  const { presets, addPreset, updatePreset, deletePreset } = useImageEditorStore()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleSave = () => {
    if (!newName) {
      message.error('名称不能为空')
      return
    }
    if (editingId) {
      updatePreset(editingId, { name: newName })
    } else {
      addPreset({ name: newName, settings: currentSettings })
    }
    setNewName('')
    setEditingId(null)
  }

  return (
    <div style={{ padding: 16 }}>
      <h4>预设</h4>
      <List
        size="small"
        dataSource={presets}
        renderItem={item => (
          <List.Item
            actions={[
              <Button key="apply" type="link" onClick={() => onApply(item.settings)}>应用</Button>,
              <Button key="edit" type="link" onClick={() => { setEditingId(item.id); setNewName(item.name) }}>重命名</Button>,
              <Button key="delete" type="link" danger onClick={() => deletePreset(item.id)}>删除</Button>
            ]}
          >
            {item.name}
          </List.Item>
        )}
      />
      <Space style={{ marginTop: 8 }}>
        <Input
          placeholder="新预设名称"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          style={{ width: 150 }}
        />
        <Button onClick={handleSave} type="primary">{editingId ? '保存' : '添加'}</Button>
      </Space>
    </div>
  )
}

export default PresetsPanel
