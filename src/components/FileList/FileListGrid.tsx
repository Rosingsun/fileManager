import React, { useEffect, useRef } from 'react'
import { Empty, Pagination } from 'antd'
import {
  FolderOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  FileZipOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import { ImageThumbnail } from './ImageThumbnail'
import { MAX_IMAGE_SIZE, PAGE_SIZE_OPTIONS } from './types'
import {
  FILE_TYPE_ICON_COLORS,
  getFileExtension,
  getFileTypeIcon,
  isLikelyLivePhoto,
  isRawImage
} from '../../utils'
import type { FileInfo } from '../../types'
import type { PreviewData } from './types'

interface FileListGridProps {
  dataSource: FileInfo[]
  total: number
  current: number
  pageSize: number
  previewVersion: number
  gridColumns: number
  previews: Map<string, PreviewData>
  loadingImages: Set<string>
  progress: Map<string, number>
  selectedRowKeys: string[]
  maxImageSize?: number
  onPreview: (file: FileInfo) => void
  onEdit?: (file: FileInfo) => void
  onDelete: (file: FileInfo) => void
  onDoubleClick: (file: FileInfo) => void
  onSelectionChange: (keys: string[]) => void
  onRegisterRef: (filePath: string, el: HTMLDivElement | null) => void
  onPageChange: (page: number, pageSize: number) => void
  isPreviewable: (file: FileInfo) => boolean
  siblingFileNames?: string[]
}

export const FileListGrid: React.FC<FileListGridProps> = ({
  dataSource,
  total,
  current,
  pageSize,
  previewVersion,
  gridColumns,
  previews,
  loadingImages,
  progress,
  selectedRowKeys,
  maxImageSize = MAX_IMAGE_SIZE,
  onPreview,
  onEdit,
  onDelete,
  onDoubleClick,
  onSelectionChange,
  onRegisterRef,
  onPageChange,
  isPreviewable,
  siblingFileNames = []
}) => {
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    contentRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }, [current, pageSize])

  const iconSize = { fontSize: 48 } as const

  const getFileIcon = (file: FileInfo) => {
    if (file.isDirectory) {
      return <FolderOutlined style={{ ...iconSize, color: FILE_TYPE_ICON_COLORS.folder }} />
    }

    const ext = getFileExtension(file.name)
    const iconType = getFileTypeIcon(ext, false)

    const iconMap: Record<string, React.ReactNode> = {
      'file-pdf': <FilePdfOutlined style={{ ...iconSize, color: FILE_TYPE_ICON_COLORS.pdf }} />,
      'file-word': <FileWordOutlined style={{ ...iconSize, color: FILE_TYPE_ICON_COLORS.word }} />,
      'file-excel': <FileExcelOutlined style={{ ...iconSize, color: FILE_TYPE_ICON_COLORS.excel }} />,
      video: <VideoCameraOutlined style={{ ...iconSize, color: FILE_TYPE_ICON_COLORS.video }} />,
      audio: <SoundOutlined style={{ ...iconSize, color: FILE_TYPE_ICON_COLORS.audio }} />,
      'file-zip': <FileZipOutlined style={{ ...iconSize, color: FILE_TYPE_ICON_COLORS.archive }} />,
    }

    return iconMap[iconType] || <FileOutlined style={{ ...iconSize, color: FILE_TYPE_ICON_COLORS.default }} />
  }

  if (dataSource.length === 0) {
    return (
      <div className="file-grid-empty">
        <div className="app-empty-state">
          <Empty description="该目录暂无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      </div>
    )
  }

  return (
    <div className="file-grid">
      <div
        ref={contentRef}
        className="file-grid__content"
        key={`grid-${previewVersion}`}
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          alignContent: 'start'
        }}
      >
        {dataSource.map(file => {
          const isSelected = selectedRowKeys.includes(file.path)
          const previewData = previews.get(file.path)
          const isLoading = loadingImages.has(file.path)
          const fileProgress = progress.get(file.path)
          const canPreview = isPreviewable(file)

          return (
            <div
              key={file.path}
              className={`file-grid-card${isSelected ? ' is-selected' : ''}${file.isDirectory ? ' is-directory' : ''}`}
              onClick={() => {
                if (file.isDirectory) {
                  onDoubleClick(file)
                } else {
                  const newKeys = isSelected
                    ? selectedRowKeys.filter(k => k !== file.path)
                    : [...selectedRowKeys, file.path]
                  onSelectionChange(newKeys)
                }
              }}
              onDoubleClick={() => onDoubleClick(file)}
            >
              <div className="file-grid-card__preview">
                {canPreview ? (
                  <ImageThumbnail
                    filePath={file.path}
                    fileName={file.name}
                    size={file.size}
                    maxSize={maxImageSize}
                    previewData={previewData}
                    isLoading={isLoading}
                    progress={fileProgress}
                    showLiveBadge={isLikelyLivePhoto(file.name, siblingFileNames)}
                    showRawBadge={isRawImage(getFileExtension(file.name))}
                    onClick={() => onPreview(file)}
                    onRef={(el) => onRegisterRef(file.path, el)}
                  />
                ) : (
                  getFileIcon(file)
                )}
                <div
                  className="file-grid-card__preview-actions"
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  {canPreview && onEdit && (
                    <button
                      type="button"
                      className="file-grid-card__preview-action-btn file-grid-card__preview-action-btn--edit"
                      title="编辑"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(file)
                      }}
                    >
                      <EditOutlined />
                    </button>
                  )}
                  {canPreview && onEdit && (
                    <span className="file-grid-card__preview-actions-divider" aria-hidden />
                  )}
                  <button
                    type="button"
                    className="file-grid-card__preview-action-btn file-grid-card__preview-action-btn--delete"
                    title="删除"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(file)
                    }}
                  >
                    <DeleteOutlined />
                  </button>
                </div>
              </div>
              <div className="file-grid-card__name" title={file.name}>
                {file.name}
              </div>
              {isSelected && (
                <div className="file-grid-card__check">✓</div>
              )}
            </div>
          )
        })}
      </div>
      <div className="file-grid__pagination">
        <Pagination
          total={total}
          current={current}
          pageSize={pageSize}
          showSizeChanger
          showQuickJumper
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          showTotal={(total) => `共 ${total} 项`}
          onChange={onPageChange}
        />
      </div>
    </div>
  )
}
