import React from 'react'
import { Table, Card, Tag, Space, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  FileOutlined,
  FolderOutlined,
  PictureOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  FileZipOutlined
} from '@ant-design/icons'
import { useFileStore } from '../stores/fileStore'
import { useFileSystem } from '../hooks/useFileSystem'
import { formatFileSize, formatDateTime, getFileExtension, getFileTypeIcon } from '../utils/fileUtils'
import type { FileInfo } from '../types'

const FileList: React.FC = () => {
  const { fileList, loading, currentPath } = useFileStore()
  const { loadDirectory } = useFileSystem()

  // 获取文件图标
  const getIcon = (file: FileInfo) => {
    if (file.isDirectory) {
      return <FolderOutlined style={{ color: '#1890ff' }} />
    }
    
    const ext = getFileExtension(file.name)
    const iconType = getFileTypeIcon(ext, false)
    
    const iconMap: Record<string, React.ReactNode> = {
      'image': <PictureOutlined style={{ color: '#52c41a' }} />,
      'file-pdf': <FilePdfOutlined style={{ color: '#ff4d4f' }} />,
      'file-word': <FileWordOutlined style={{ color: '#1890ff' }} />,
      'file-excel': <FileExcelOutlined style={{ color: '#52c41a' }} />,
      'video': <VideoCameraOutlined style={{ color: '#faad14' }} />,
      'audio': <SoundOutlined style={{ color: '#722ed1' }} />,
      'file-zip': <FileZipOutlined style={{ color: '#fa8c16' }} />
    }
    
    return iconMap[iconType] || <FileOutlined />
  }

  const columns: ColumnsType<FileInfo> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: '40%',
      render: (text: string, record: FileInfo) => (
        <Space>
          {getIcon(record)}
          <span>{text}</span>
          {record.isDirectory && <Tag color="blue">文件夹</Tag>}
        </Space>
      )
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: '15%',
      render: (size: number, record: FileInfo) => 
        record.isDirectory ? '-' : formatFileSize(size)
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedTime',
      key: 'modifiedTime',
      width: '25%',
      render: (time: number) => formatDateTime(time)
    },
    {
      title: '创建时间',
      dataIndex: 'createdTime',
      key: 'createdTime',
      width: '20%',
      render: (time: number) => formatDateTime(time)
    }
  ]

  if (!currentPath) {
    return (
      <Card title="文件列表" style={{ height: '100%' }}>
        <Empty description="请先选择目录" />
      </Card>
    )
  }

  return (
    <Card title="文件列表" style={{ height: '100%' }}>
      <Table
        columns={columns}
        dataSource={fileList}
        loading={loading}
        rowKey="path"
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 项`
        }}
        size="small"
        onRow={(record) => ({
          onDoubleClick: () => {
            if (record.isDirectory) {
              loadDirectory(record.path)
            }
          },
          style: { cursor: record.isDirectory ? 'pointer' : 'default' }
        })}
      />
    </Card>
  )
}

export default FileList

