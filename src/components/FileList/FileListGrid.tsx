import React, { useEffect, useRef } from 'react'
import { Empty, Spin } from 'antd'
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
import { MAX_IMAGE_SIZE } from './types'
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
  /** 当前应展示的数据（默认浏览态为已加载的累计片段；筛选态为前端过滤结果） */
  dataSource: FileInfo[]
  /** 过滤后条目总数 */
  total: number
  gridColumns: number
  previews: Map<string, PreviewData>
  loadingImages: Set<string>
  progress: Map<string, number>
  selectedRowKeys: string[]
  maxImageSize?: number
  /** 首屏/切换目录时的整体加载态 */
  loadingFull?: boolean
  /** 滚动到底正在加载更多 */
  loadingMore?: boolean
  /** 是否已全部加载（无更多可追加） */
  done?: boolean
  /** 滚动到底触底回调（默认浏览态传入；筛选态可缺省） */
  onLoadMore?: () => void
  onPreview: (file: FileInfo) => void
  onEdit?: (file: FileInfo) => void
  onDelete: (file: FileInfo) => void
  onDoubleClick: (file: FileInfo) => void
  onSelectionChange: (keys: string[]) => void
  onRegisterRef: (filePath: string, el: HTMLDivElement | null) => void
  isPreviewable: (file: FileInfo) => boolean
  isPreviewableImage: (file: FileInfo) => boolean
  siblingFileNames?: string[]
}

export const FileListGrid: React.FC<FileListGridProps> = ({
  dataSource,
  total,
  gridColumns,
  previews,
  loadingImages,
  progress,
  selectedRowKeys,
  maxImageSize = MAX_IMAGE_SIZE,
  loadingFull = false,
  loadingMore = false,
  done = false,
  onLoadMore,
  onPreview,
  onEdit,
  onDelete,
  onDoubleClick,
  onSelectionChange,
  onRegisterRef,
  isPreviewable,
  isPreviewableImage,
  siblingFileNames = []
}) => {
  const contentRef = useRef<HTMLDivElement | null>(null)

  // 滚动到底自动加载更多
  const handleScroll = () => {
    const el = contentRef.current
    if (!el || !onLoadMore || loadingMore || done) return
    // 距底部 80px 内即触发
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      onLoadMore()
    }
  }

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

  if (loadingFull) {
    return (
      <div className="file-grid-empty">
        <div className="app-empty-state">
          <Spin tip="正在加载…" />
        </div>
      </div>
    )
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

  const showLoadBar = Boolean(onLoadMore)

  return (
    <div className="file-grid">
      <div
        ref={contentRef}
        className="file-grid__content"
        style={{
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          alignContent: 'start'
        }}
        onScroll={handleScroll}
      >
        {dataSource.map(file => {
          const isSelected = selectedRowKeys.includes(file.path)
          const previewData = previews.get(file.path)
          const isLoading = loadingImages.has(file.path)
          const fileProgress = progress.get(file.path)
          const canPreview = isPreviewable(file)
          const canPreviewImage = isPreviewableImage(file)

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
                {canPreviewImage ? (
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
                ) : canPreview ? (
                  <div
                    className="media-preview-grid-hit"
                    role="button"
                    tabIndex={0}
                    title="预览"
                    onClick={() => onPreview(file)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPreview(file)
                      }
                    }}
                  >
                    {getFileIcon(file)}
                  </div>
                ) : (
                  getFileIcon(file)
                )}
                <div
                  className="file-grid-card__preview-actions"
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  {canPreviewImage && onEdit && (
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
                  {canPreviewImage && onEdit && (
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
      {showLoadBar && (
        <div className="file-grid__pagination">
          {done ? (
            <span style={{ color: 'var(--app-text-secondary)' }}>已全部加载 · 共 {total} 项</span>
          ) : loadingMore ? (
            <span style={{ color: 'var(--app-text-secondary)' }}><Spin size="small" /> 正在加载更多…</span>
          ) : (
            <span style={{ color: 'var(--app-text-secondary)' }}>继续下滑加载更多 · 已加载 {dataSource.length}/{total} 项</span>
          )}
        </div>
      )}
    </div>
  )
}
