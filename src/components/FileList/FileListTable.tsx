import React, { useMemo, useRef, useEffect } from 'react'
import { Table, Tag, Space, Spin } from 'antd'
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
import { getClassificationDisplayLabel } from '../../types'
import { CATEGORY_COLORS, MAX_IMAGE_SIZE } from './types'
import type { FileInfo } from '../../types'
import type { PreviewData } from './types'

interface FileListTableProps {
  dataSource: FileInfo[]
  total?: number
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
  /** 滚动到底正在加载更多 */
  loadingMore?: boolean
  /** 是否已全部加载（无更多可追加） */
  done?: boolean
  /** 滚动到底触底回调（默认浏览态传入） */
  onLoadMore?: () => void
  onPreview: (file: FileInfo) => void
  onEdit?: (file: FileInfo) => void
  onRename: (file: FileInfo) => void
  onDelete: (file: FileInfo) => void
  onDoubleClick: (file: FileInfo) => void
  onSelectionChange: (keys: string[], rows: FileInfo[]) => void
  onRegisterRef: (filePath: string, el: HTMLDivElement | null) => void
  isPreviewable: (file: FileInfo) => boolean
  isPreviewableImage: (file: FileInfo) => boolean
}

export const FileListTable: React.FC<FileListTableProps> = ({
  dataSource,
  total,
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
  loadingMore = false,
  done = false,
  onLoadMore,
  onPreview,
  onEdit,
  onRename,
  onDelete,
  onDoubleClick,
  onSelectionChange,
  onRegisterRef,
  isPreviewable,
  isPreviewableImage
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // 监听 antd 表格体滚动，接近底部时触发加载更多
  useEffect(() => {
    const root = wrapRef.current
    const body = root?.querySelector<HTMLElement>('.ant-table-body')
    if (!body) return

    const handler = () => {
      if (!onLoadMore || loadingMore || done) return
      if (body.scrollHeight - body.scrollTop - body.clientHeight < 80) {
        onLoadMore()
      }
    }
    body.addEventListener('scroll', handler, { passive: true })
    return () => body.removeEventListener('scroll', handler)
  }, [onLoadMore, loadingMore, done, dataSource.length, previewVersion])

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
          const tagColor =
            classification.classificationStatus === 'failed'
              ? 'red'
              : classification.classificationStatus === 'uncertain'
                ? 'orange'
                : CATEGORY_COLORS[classification.category as keyof typeof CATEGORY_COLORS] || 'default'
          return (
            <Tag color={tagColor}>
              {getClassificationDisplayLabel(classification)}
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

  const showLoadFooter = Boolean(onLoadMore)

  const footerNode = showLoadFooter ? (
    <div style={{ textAlign: 'center', padding: '6px 0', color: 'var(--app-text-secondary)', fontSize: 12 }}>
      {done ? (
        `已全部加载 · 共 ${total} 项`
      ) : loadingMore ? (
        <span><Spin size="small" /> 正在加载更多…</span>
      ) : (
        `继续下滑加载更多 · 已加载 ${dataSource.length}/${total} 项`
      )}
    </div>
  ) : null

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Table
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        rowKey="path"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys, rows) => onSelectionChange(keys as string[], rows)
        }}
        scroll={{ x: true, y: selectedRows.length > 0 ? 'calc(100vh - 300px)' : 'calc(100vh - 315px)' }}
        // rc-table 会将 footer 作为函数调用，必须传 (data) => ReactNode，不能直接传 React 元素
        footer={() => footerNode}
        pagination={false}
        onRow={(record) => ({
          onDoubleClick: () => onDoubleClick(record),
          style: { cursor: record.isDirectory ? 'pointer' : 'default', height: '40px' }
        })}
      />
    </div>
  )
}
