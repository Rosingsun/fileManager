import React, { useState, useEffect } from 'react'
import { Table, Card, Tag, Space, Empty, Modal, Input, message } from 'antd'
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
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renamingFile, setRenamingFile] = useState<FileInfo | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deletingFile, setDeletingFile] = useState<FileInfo | null>(null)
  const [imagePreviews, setImagePreviews] = useState<Map<string, string>>(new Map())

  // 加载图片预览
  useEffect(() => {
    const loadImagePreviews = async () => {
      const newPreviews = new Map<string, string>()
      for (const file of fileList) {
        if (isPreviewable(file) && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(getFileExtension(file.name).toLowerCase())) {
          try {
            const base64 = await window.electronAPI?.getImageBase64(file.path)
            if (base64) {
              newPreviews.set(file.path, base64)
            }
          } catch (error) {
            console.error('加载图片预览失败:', file.path, error)
          }
        }
      }
      setImagePreviews(newPreviews)
    }

    if (fileList.length > 0) {
      loadImagePreviews()
    }
  }, [fileList])

  // 判断文件是否可预览
  const isPreviewable = (file: FileInfo): boolean => {
    if (file.isDirectory) return false
    const ext = getFileExtension(file.name).toLowerCase()
    const previewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'mp3', 'wav', 'flac', 'aac']
    return previewableTypes.includes(ext)
  }

  // 预览文件
  const handlePreview = (file: FileInfo) => {
    if (window.electronAPI && window.electronAPI.previewFile) {
      window.electronAPI.previewFile(file.path)
    }
  }

  // 重命名文件
  const handleRename = (file: FileInfo) => {
    setRenamingFile(file)
    setNewFileName(file.name)
    setRenameModalVisible(true)
  }

  const handleRenameConfirm = async () => {
    if (!renamingFile || !newFileName.trim()) return

    try {
      const success = await window.electronAPI?.renameFile(renamingFile.path, newFileName.trim())
      if (success) {
        message.success('重命名成功')
        // 重新加载目录
        if (currentPath) {
          loadDirectory(currentPath)
        }
      } else {
        message.error('重命名失败')
      }
    } catch (error) {
      message.error('重命名失败')
    }
    setRenameModalVisible(false)
    setRenamingFile(null)
    setNewFileName('')
  }

  const handleRenameCancel = () => {
    setRenameModalVisible(false)
    setRenamingFile(null)
    setNewFileName('')
  }

  // 删除文件
  const handleDelete = (file: FileInfo) => {
    setDeletingFile(file)
    setDeleteModalVisible(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingFile) return

    try {
      const success = await window.electronAPI?.deleteFile(deletingFile.path)
      if (success) {
        message.success('删除成功')
        // 重新加载目录
        if (currentPath) {
          loadDirectory(currentPath)
        }
      } else {
        message.error('删除失败')
      }
    } catch (error) {
      message.error('删除失败')
    }
    setDeleteModalVisible(false)
    setDeletingFile(null)
  }

  const handleDeleteCancel = () => {
    setDeleteModalVisible(false)
    setDeletingFile(null)
  }

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
      title: '预览',
      key: 'preview',
      width: '10%',
      render: (_, record: FileInfo) => {
        if (isPreviewable(record)) {
          const base64 = imagePreviews.get(record.path)
          if (base64) {
            return <img src={base64} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }} />
          } else {
            // 显示加载中或占位符
            return <div style={{ width: 50, height: 50, backgroundColor: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PictureOutlined style={{ color: '#ccc' }} />
            </div>
          }
        }
        return null
      }
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: '30%',
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
      title: '操作',
      key: 'action',
      width: '20%',
      render: (_, record: FileInfo) => (
        <Space>
          <span
            style={{ color: '#1890ff', cursor: 'pointer' }}
            onClick={() => handlePreview(record)}
            title={isPreviewable(record) ? '预览文件' : '此文件类型不支持预览'}
          >
            查看
          </span>
          <span
            style={{ color: '#1890ff', cursor: 'pointer' }}
            onClick={() => handleRename(record)}
            title="重命名"
          >
            重命名
          </span>
          <span
            style={{ color: 'red', cursor: 'pointer' }}
            onClick={() => handleDelete(record)}
            title="删除"
          >
            删除
          </span>
        </Space>
      )
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
        scroll={{ x: true, y: 'calc(100% - 80px)' }}
        size="small"
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 项`,
          position: ['bottomCenter']
        }}
        onRow={(record) => ({
          onDoubleClick: () => {
            if (record.isDirectory) {
              loadDirectory(record.path)
            }
          },
          style: { cursor: record.isDirectory ? 'pointer' : 'default' }
        })}
      />
      <Modal
        title="重命名文件"
        open={renameModalVisible}
        onOk={handleRenameConfirm}
        onCancel={handleRenameCancel}
        okText="确定"
        cancelText="取消"
      >
        <Input
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          placeholder="请输入新文件名"
          onPressEnter={handleRenameConfirm}
        />
      </Modal>
      <Modal
        title="确认删除"
        open={deleteModalVisible}
        onOk={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        okText="确定删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除 "{deletingFile?.name}" 吗？</p>
        <p style={{ color: '#ff4d4f' }}>此操作不可撤销！</p>
      </Modal>
    </Card>
  )
}

export default FileList

