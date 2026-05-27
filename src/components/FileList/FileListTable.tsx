import React, { useMemo } from 'react'
import { Table, Tag, Space } from 'antd'
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
import { FILE_TYPE_ICON_COLORS, formatFileSize, formatDateTime, getFileExtension, getFileTypeIcon } from '../../utils'
import { ImageThumbnail } from './ImageThumbnail'
import { CATEGORY_COLORS, CATEGORY_LABELS, MAX_IMAGE_SIZE, PAGE_SIZE_OPTIONS } from './types'
import type { FileInfo } from '../../types'
import type { PreviewData } from './types'

interface FileListTableProps {
  dataSource: FileInfo[]
  total?: number
  current?: number
  pageSize?: number
  loading: boolean
  previewEnabled: boolean
  previewVersion: number
  previews: Map<string, PreviewData>
  loadingImages: Set<string>
  progress: Map<string, number>
  imageClassificationResults: Map<string, { category: string; confidence: number }>
  selectedRowKeys: string[]
  selectedRows: FileInfo[]
  maxImageSize?: number
  onPreview: (file: FileInfo) => void
  onEdit?: (file: FileInfo) => void
  onRename: (file: FileInfo) => void
  onDelete: (file: FileInfo) => void
  onDoubleClick: (file: FileInfo) => void
  onSelectionChange: (keys: string[], rows: FileInfo[]) => void
  onRegisterRef: (filePath: string, el: HTMLDivElement | null) => void
  onPageChange?: (page: number, pageSize: number) => void
  isPreviewable: (file: FileInfo) => boolean
  isPreviewableImage: (file: FileInfo) => boolean
}

export const FileListTable: React.FC<FileListTableProps> = ({
  dataSource,
  total,
  current,
  pageSize,
  loading,
  previewEnabled,
  previewVersion,
  previews,
  loadingImages,
  progress,
  imageClassificationResults,
  selectedRowKeys,
  selectedRows,
  maxImageSize = MAX_IMAGE_SIZE,
  onPreview,
  onEdit,
  onRename,
  onDelete,
  onDoubleClick,
  onSelectionChange,
  onRegisterRef,
  isPreviewable,
  isPreviewableImage,
  onPageChange
}) => {
  const getIcon = (file: FileInfo) => {
    if (file.isDirectory) {
      return <FolderOutlined style={{ color: FILE_TYPE_ICON_COLORS.folder }} />
    }

    const ext = getFileExtension(file.name)
    const iconType = getFileTypeIcon(ext, false)

    const iconMap: Record<string, React.ReactNode> = {
      image: <PictureOutlined style={{ color: 'var(--app-success)' }} />,
      'file-pdf': <FilePdfOutlined style={{ color: FILE_TYPE_ICON_COLORS.pdf }} />,
      'file-word': <FileWordOutlined style={{ color: FILE_TYPE_ICON_COLORS.word }} />,
      'file-excel': <FileExcelOutlined style={{ color: FILE_TYPE_ICON_COLORS.excel }} />,
      video: <VideoCameraOutlined style={{ color: FILE_TYPE_ICON_COLORS.video }} />,
      audio: <SoundOutlined style={{ color: FILE_TYPE_ICON_COLORS.audio }} />,
      'file-zip': <FileZipOutlined style={{ color: FILE_TYPE_ICON_COLORS.archive }} />,
    }

    return iconMap[iconType] || <FileOutlined style={{ color: FILE_TYPE_ICON_COLORS.default }} />
  }

  const columns: ColumnsType<FileInfo> = useMemo(() => [
    ...(previewEnabled ? [{
      title: '预览',
      key: 'preview',
      width: 80,
      render: (_: unknown, record: FileInfo) => {
        if (!isPreviewable(record)) return null

        const previewData = previews.get(record.path)
        const isLoading = loadingImages.has(record.path)
        const fileProgress = progress.get(record.path)
        const showImageThumb = isPreviewableImage(record)

        return (
          <div
            ref={showImageThumb ? (el) => onRegisterRef(record.path, el) : undefined}
            className={showImageThumb ? undefined : 'media-preview-table-hit'}
            style={{ width: 50, height: 50, borderRadius: 4, overflow: 'hidden', cursor: 'pointer' }}
            onClick={() => onPreview(record)}
          >
            {showImageThumb ? (
              <ImageThumbnail
                filePath={record.path}
                fileName={record.name}
                size={record.size}
                maxSize={maxImageSize}
                previewData={previewData}
                isLoading={isLoading}
                progress={fileProgress}
              />
            ) : (
              getIcon(record)
            )}
          </div>
        )
      }
    }] : []),
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: previewEnabled ? 250 : 300,
      render: (text: string, record: FileInfo) => (
        <Space>
          {getIcon(record)}
          <span style={{ maxWidth: '10em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }} title={text}>
            {text}
          </span>
          {record.isDirectory && <Tag color="blue">文件夹</Tag>}
        </Space>
      )
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number, record: FileInfo) =>
        record.isDirectory ? '-' : formatFileSize(size)
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedTime',
      key: 'modifiedTime',
      width: 180,
      render: (time: number) => formatDateTime(time)
    },
    {
      title: '分类',
      key: 'classification',
      width: 100,
      render: (_: unknown, record: FileInfo) => {
        const classification = imageClassificationResults.get(record.path)
        if (classification) {
          return (
            <Tag color={CATEGORY_COLORS[classification.category as keyof typeof CATEGORY_COLORS] || 'default'}>
              {CATEGORY_LABELS[classification.category as keyof typeof CATEGORY_LABELS] || classification.category}
            </Tag>
          )
        }
        return '-'
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: FileInfo) => (
        <Space>
          <span
            className="app-text-link"
            onClick={() => onPreview(record)}
            title={isPreviewable(record) ? '预览文件' : '此文件类型不支持预览'}
          >
            查看
          </span>
          {isPreviewableImage(record) && onEdit && (
            <span
              className="app-text-link"
              onClick={() => onEdit(record)}
              title="编辑"
            >
              编辑
            </span>
          )}
          <span
            className="app-text-link"
            onClick={() => onRename(record)}
            title="重命名"
          >
            重命名
          </span>
          <span
            style={{ color: 'red', cursor: 'pointer' }}
            onClick={() => onDelete(record)}
            title="删除"
          >
            删除
          </span>
        </Space>
      )
    }
  ], [previewEnabled, previews, loadingImages, progress, imageClassificationResults, maxImageSize, onPreview, onRename, onDelete, onRegisterRef, isPreviewable, isPreviewableImage])

  return (
    <Table
      key={`table-${previewVersion}`}
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      rowKey="path"
      rowSelection={{
        selectedRowKeys,
        onChange: (keys, rows) => onSelectionChange(keys as string[], rows)
      }}
      scroll={{ x: true, y: selectedRows.length > 0 ? 'calc(100vh - 260px)' : 'calc(100vh - 275px)' }}
      onRow={(record) => ({
        onDoubleClick: () => onDoubleClick(record),
        style: { cursor: record.isDirectory ? 'pointer' : 'default', height: '40px' }
      })}
      pagination={{
        current,
        pageSize,
        total,
        showSizeChanger: true,
        showQuickJumper: true,
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        showTotal: (total) => `共 ${total} 项`,
        onChange: onPageChange
      }}
    />
  )
}
