import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Space } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { TbFileTypePdf, TbMusic, TbVideo } from '../icons'
import type { FileInfo } from '../../types'
import { getFileExtension, toMediaLocalUrl } from '../../utils'
import type { MediaPreviewKind } from '../../utils'
import './media-preview.css'

export interface MediaPreviewModalProps {
  visible: boolean
  kind: MediaPreviewKind
  files: FileInfo[]
  currentIndex: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

const KIND_META: Record<
  Exclude<MediaPreviewKind, 'image'>,
  { title: string; icon: React.ReactNode }
> = {
  video: { title: '视频预览', icon: <TbVideo size={18} /> },
  audio: { title: '音频预览', icon: <TbMusic size={18} /> },
  pdf: { title: 'PDF 阅读', icon: <TbFileTypePdf size={18} /> }
}

const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  visible,
  kind,
  files,
  currentIndex,
  onClose,
  onIndexChange
}) => {
  const current = files[currentIndex]
  const mediaUrl = current ? toMediaLocalUrl(current.path) : ''
  const ext = current ? getFileExtension(current.name) : ''
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setLoadError(null)
  }, [current?.path, kind])

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onIndexChange(currentIndex - 1)
      } else if (e.key === 'ArrowRight' && currentIndex < files.length - 1) {
        onIndexChange(currentIndex + 1)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, currentIndex, files.length, onClose, onIndexChange])

  const title = useMemo(() => {
    if (!current || kind === 'image') return '预览'
    const meta = KIND_META[kind]
    return (
      <Space size={8}>
        {meta.icon}
        <span>{meta.title}</span>
        <span style={{ fontWeight: 400, color: 'var(--app-text-secondary)' }}>
          {current.name}
        </span>
      </Space>
    )
  }, [current, kind])

  const stage = useMemo(() => {
    if (!current || !mediaUrl) return null
    if (kind === 'video') {
      return (
        <video
          key={current.path}
          className="media-preview__video"
          src={mediaUrl}
          controls
          playsInline
          preload="auto"
          onError={() => setLoadError('视频无法播放，请确认文件未损坏或格式受支持')}
        />
      )
    }
    if (kind === 'audio') {
      return (
        <div className="media-preview__audio-wrap">
          <TbMusic className="media-preview__audio-icon" size={56} aria-hidden />
          <audio
            key={current.path}
            className="media-preview__audio"
            src={mediaUrl}
            controls
            preload="auto"
            onError={() => setLoadError('音频无法播放，请确认文件未损坏或格式受支持')}
          />
        </div>
      )
    }
    if (kind === 'pdf') {
      return (
        <embed
          key={current.path}
          className="media-preview__pdf"
          src={mediaUrl}
          type="application/pdf"
          title={current.name}
          onError={() => setLoadError('PDF 无法加载')}
        />
      )
    }
    return null
  }, [current, kind, mediaUrl])

  if (kind === 'image') return null

  return (
    <Modal
      className="media-preview-modal"
      title={title}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={kind === 'audio' ? 520 : kind === 'pdf' ? 900 : 960}
      destroyOnClose
      centered
    >
      <div className="media-preview">
        <div className="media-preview__stage">
          {loadError ? (
            <p className="media-preview__error" role="alert">
              {loadError}
            </p>
          ) : (
            stage
          )}
        </div>
        {files.length > 1 && (
          <div className="media-preview__nav">
            <Button
              type="text"
              icon={<LeftOutlined />}
              disabled={currentIndex <= 0}
              onClick={() => onIndexChange(currentIndex - 1)}
            />
            <span className="media-preview__nav-index">
              {currentIndex + 1} / {files.length}
            </span>
            <Button
              type="text"
              icon={<RightOutlined />}
              disabled={currentIndex >= files.length - 1}
              onClick={() => onIndexChange(currentIndex + 1)}
            />
          </div>
        )}
        {current && (
          <div className="media-preview__path" title={current.path}>
            {current.path}
            {ext ? ` · .${ext}` : ''}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default MediaPreviewModal
