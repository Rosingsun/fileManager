import React from 'react'
import { Empty, Pagination } from 'antd'
import { ImageThumbnail } from './ImageThumbnail'
import { MAX_IMAGE_SIZE, PAGE_SIZE_OPTIONS } from './types'
import type { FileInfo } from '../../types'
import type { PreviewData } from './types'

interface FileListGridProps {
  dataSource: FileInfo[]
  total: number
  previewVersion: number
  gridColumns: number
  previews: Map<string, PreviewData>
  loadingImages: Set<string>
  progress: Map<string, number>
  selectedRowKeys: string[]
  maxImageSize?: number
  onPreview: (file: FileInfo) => void
  onDoubleClick: (file: FileInfo) => void
  onSelectionChange: (keys: string[]) => void
  onRegisterRef: (filePath: string, el: HTMLDivElement | null) => void
  onPageChange: (page: number, pageSize: number) => void
  isPreviewable: (file: FileInfo) => boolean
}

export const FileListGrid: React.FC<FileListGridProps> = ({
  dataSource,
  total,
  previewVersion,
  gridColumns,
  previews,
  loadingImages,
  progress,
  selectedRowKeys,
  maxImageSize = MAX_IMAGE_SIZE,
  onPreview,
  onDoubleClick,
  onSelectionChange,
  onRegisterRef,
  onPageChange,
  isPreviewable
}) => {
  if (dataSource.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="该目录暂无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        key={`grid-${previewVersion}`}
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          gap: '10px',
          padding: '10px',
          overflowY: 'auto',
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
              style={{
                border: `1px solid ${isSelected ? '#1890ff' : '#d9d9d9'}`,
                borderRadius: '5px',
                overflow: 'hidden',
                cursor: file.isDirectory ? 'pointer' : 'default',
                position: 'relative',
                backgroundColor: isSelected ? '#e6f7ff' : '#fff',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease'
              }}
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
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  backgroundColor: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {canPreview ? (
                  <ImageThumbnail
                    filePath={file.path}
                    fileName={file.name}
                    size={file.size}
                    maxSize={maxImageSize}
                    previewData={previewData}
                    isLoading={isLoading}
                    progress={fileProgress}
                    onClick={() => onPreview(file)}
                    onRef={(el) => onRegisterRef(file.path, el)}
                  />
                ) : (
                  <span style={{ color: '#999', fontSize: '12px' }}>无预览</span>
                )}
              </div>
              <div
                style={{
                  padding: '8px',
                  fontSize: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'center'
                }}
                title={file.name}
              >
                {file.name}
              </div>
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '10px'
                  }}
                >
                  ✓
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ padding: '10px', borderTop: '1px solid #f0f0f0', textAlign: 'right' }}>
        <Pagination
          total={total}
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
