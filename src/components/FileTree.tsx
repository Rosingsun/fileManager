import React from 'react'
import { Empty, Button, Popconfirm, Tooltip, List } from 'antd'
import { DeleteOutlined, ClearOutlined } from '@ant-design/icons'
import { useFileStore } from '../stores'
import { useFileSystem } from '../hooks'
import { formatDateTime } from '../utils'
import { GlassCard } from './UnifiedUI'
import type { HistoryItem } from '../types'

const FileTree: React.FC = () => {
  const { currentPath, historyList, removeHistory, clearHistory } = useFileStore()
  const { loadDirectoryFromHistory } = useFileSystem()

  const onSelect = (path: string) => {
    loadDirectoryFromHistory(path)
  }

  const handleRemoveHistory = (e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    removeHistory(path)
    if (currentPath === path) {
      useFileStore.getState().resetDirectory()
    }
  }

  const titleNode = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>最近目录</span>
      {historyList.length > 0 && (
        <Popconfirm
          title="确定要清空所有历史记录吗？"
          onConfirm={() => {
            clearHistory()
            useFileStore.getState().resetDirectory()
          }}
          okText="确定"
          cancelText="取消"
        >
          <Button
            type="text"
            size="small"
            icon={<ClearOutlined />}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          />
        </Popconfirm>
      )}
    </div>
  )

  if (historyList.length === 0) {
    return (
      <GlassCard title={titleNode} size="small" fillHeight className="app-sidebar-recent-card">
        <Empty description="暂无最近目录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </GlassCard>
    )
  }

  return (
    <GlassCard
      title={titleNode}
      size="small"
      fillHeight
      className="app-sidebar-recent-card"
      styles={{ body: { overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column' } }}
    >
      <List
        dataSource={historyList}
        renderItem={(item: HistoryItem) => (
          <List.Item
            className={item.path === currentPath ? 'file-history-item is-active' : 'file-history-item'}
            actions={[
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={(e: React.MouseEvent) => handleRemoveHistory(e, item.path)}
              />,
            ]}
            onClick={() => onSelect(item.path)}
          >
            <List.Item.Meta
              title={<Tooltip title={item.path} placement="right">{item.name}</Tooltip>}
              description={formatDateTime(item.timestamp)}
            />
          </List.Item>
        )}
      />
    </GlassCard>
  )
}

export default FileTree
