import React from 'react'
import { Card, Empty, Button, Popconfirm, Tooltip, List } from 'antd'
import { DeleteOutlined, ClearOutlined } from '@ant-design/icons'
import { useFileStore } from '../stores/fileStore'
import { useFileSystem } from '../hooks/useFileSystem'
import { formatDateTime } from '../utils/fileUtils'
import type { HistoryItem } from '../types'

const FileTree: React.FC = () => {
  const { currentPath, historyList, removeHistory, clearHistory } = useFileStore()
  const { loadDirectoryFromHistory } = useFileSystem()

  const onSelect = (path: string) => {
    loadDirectoryFromHistory(path)
  }

  const handleRemoveHistory = (e: React.MouseEvent, path: string) => {
    e.stopPropagation() // 阻止选择事件
    removeHistory(path)
    if (currentPath === path) {
      // 如果删除的是当前选中的路径，清空当前路径
      useFileStore.getState().setCurrentPath(null)
      useFileStore.getState().setFileList([])
    }
  }

  const titleNode = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>目录历史</span>
      {historyList.length > 0 && (
        <Popconfirm
          title="确定要清空所有历史记录吗？"
          onConfirm={() => {
            clearHistory()
            useFileStore.getState().setCurrentPath(null)
            useFileStore.getState().setFileList([])
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
      <Card title={titleNode} size="small" style={{ height: '100%' }} >
        <Empty description="暂无历史记录" />
      </Card>
    )
  }

  return (
    <Card title={titleNode} size="small" style={{ height: '100%', display: 'flex', flexDirection: 'column' }} bodyStyle={{ overflow: 'scroll' }}>
      <div style={{ flex: 1, overflow: 'auto', maxHeight: '100%' }}>
        <List
          dataSource={historyList}
          renderItem={(item: HistoryItem) => (
            <List.Item
              actions={[
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e: React.MouseEvent) => handleRemoveHistory(e, item.path)}
                  style={{ opacity: 0.6 }}
                />
              ]}
              onClick={() => onSelect(item.path)}
              style={{ 
                cursor: 'pointer',
                backgroundColor: item.path === currentPath ? '#e6f7ff' : 'transparent',
                padding: '2px 8px',
                borderRadius: 4,
                width: '100%'
              }}
            >
              <List.Item.Meta
                title={<Tooltip title={item.path} placement="right">{item.name}</Tooltip>}
                description={formatDateTime(item.timestamp)}
              />
            </List.Item>
          )}
        />
      </div>
    </Card>
  )
}

export default FileTree

