import React, { useEffect } from 'react'
import { Tree, Card, Empty } from 'antd'
import { FolderOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { useFileStore } from '../stores/fileStore'
import { useFileSystem } from '../hooks/useFileSystem'
import type { TreeNode } from '../types'

const FileTree: React.FC = () => {
  const { currentPath, treeData, setTreeData } = useFileStore()
  const { loadDirectory } = useFileSystem()

  useEffect(() => {
    // TODO: 实现文件树数据加载
    // 这里可以扩展为递归加载目录树
    if (currentPath) {
      setTreeData([{
        key: currentPath,
        title: currentPath.split(/[/\\]/).pop() || currentPath,
        path: currentPath,
        isLeaf: false
      }])
    } else {
      setTreeData([])
    }
  }, [currentPath, setTreeData])

  const onSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const path = selectedKeys[0] as string
      loadDirectory(path)
    }
  }

  if (!currentPath) {
    return (
      <Card title="目录树" size="small" style={{ height: '100%' }}>
        <Empty description="请先选择目录" />
      </Card>
    )
  }

  return (
    <Card title="目录树" size="small" style={{ height: '100%' }}>
      <Tree
        showIcon
        defaultExpandAll
        selectedKeys={currentPath ? [currentPath] : []}
        onSelect={onSelect}
        treeData={treeData}
        draggable={false}
        icon={(props: any) => 
          props.expanded ? <FolderOpenOutlined /> : <FolderOutlined />
        }
      />
    </Card>
  )
}

export default FileTree

