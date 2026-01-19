import React, { useEffect } from 'react'
import { Tree, Card, Empty, Button, Popconfirm, Space, Tooltip } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { FolderOutlined, FolderOpenOutlined, DeleteOutlined, ClearOutlined } from '@ant-design/icons'
import { useFileStore } from '../stores/fileStore'
import { useFileSystem } from '../hooks/useFileSystem'
import { formatDateTime } from '../utils/fileUtils'
import type { TreeNode, HistoryItem } from '../types'

const FileTree: React.FC = () => {
  const { currentPath, treeData, setTreeData, historyList, removeHistory, clearHistory } = useFileStore()
  const { loadDirectoryFromHistory } = useFileSystem()
  const [selectedKeys, setSelectedKeys] = React.useState<React.Key[]>([])

  useEffect(() => {
    // 将历史记录转换为树节点数据
    const nodes: TreeNode[] = historyList.map((item: HistoryItem) => ({
      key: item.path,
      title: item.name,
      path: item.path,
      isLeaf: false
    }))
    setTreeData(nodes)
  }, [historyList, setTreeData])

  const onSelect = (selectedKeys: React.Key[]) => {
    setSelectedKeys(selectedKeys)
    if (selectedKeys.length > 0) {
      const path = selectedKeys[0] as string
      loadDirectoryFromHistory(path)
    }
  }

  const handleRemoveHistory = (e: React.MouseEvent, path: string) => {
    e.stopPropagation() // 阻止树节点选择事件
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
      <Card title={titleNode} size="small" style={{ height: '100%' }}>
        <Empty description="暂无历史记录" />
      </Card>
    )
  }

  return (
    <Card title={titleNode} size="small" style={{ height: '100%' }}>
      <Tree
        showIcon
        selectedKeys={selectedKeys}
        onSelect={onSelect}
        treeData={treeData}
        draggable={false}
        icon={(props: any) => 
          props.expanded ? <FolderOpenOutlined /> : <FolderOutlined />
        }
        titleRender={(node: DataNode) => {
          const treeNode = node as TreeNode
          const historyItem = historyList.find((item: HistoryItem) => item.path === treeNode.path)
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Tooltip title={treeNode.path} placement="right">
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {treeNode.title}
                </span>
              </Tooltip>
              <Space size="small" style={{ marginLeft: 8 }}>
                {historyItem && (
                  <span style={{ fontSize: 11, color: '#999', whiteSpace: 'nowrap' }}>
                    {formatDateTime(historyItem.timestamp)}
                  </span>
                )}
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e: React.MouseEvent) => handleRemoveHistory(e, treeNode.path)}
                  style={{ opacity: 0.6 }}
                />
              </Space>
            </div>
          )
        }}
      />
    </Card>
  )
}

export default FileTree

