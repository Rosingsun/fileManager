import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Empty, Modal, Spin } from 'antd'
import {
  CloseOutlined,
  FolderOutlined,
  LeftOutlined,
  PictureOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { cloudGetDownloadTicket } from '../../utils'
import type { CloudFileEntry, CloudProviderId } from '../../types/cloud'

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|bmp|webp|svg|heic|heif|avif|tiff?|ico)$/i
/** 获取下载链接的并发上限，避免瞬时请求过多触发限流 */
const TICKET_CONCURRENCY = 6

export function isCloudImageName(name: string): boolean {
  return IMAGE_EXT_RE.test(name)
}

interface CloudPhotoGridProps {
  providerId: CloudProviderId
  entries: CloudFileEntry[]
  loading: boolean
  onEnterFolder: (entry: CloudFileEntry) => void
}

const CloudPhotoGrid: React.FC<CloudPhotoGridProps> = ({ providerId, entries, loading, onEnterFolder }) => {
  const photos = useMemo(() => entries.filter(e => e.kind === 'file' && isCloudImageName(e.name)), [entries])
  const folders = useMemo(() => entries.filter(e => e.kind === 'folder'), [entries])
  const hiddenFiles = Math.max(0, entries.length - photos.length - folders.length)

  const [urlMap, setUrlMap] = useState<Record<string, string>>({})
  const [failMap, setFailMap] = useState<Record<string, boolean>>({})
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)

  // 目录变化时：限制并发地获取每张照片的短时下载链接
  useEffect(() => {
    let cancelled = false
    setUrlMap({})
    setFailMap({})
    setPreviewIdx(null)
    const ids = photos.map(p => p.fileId)
    if (ids.length === 0) return undefined
    let cursor = 0
    const workers = Array.from({ length: Math.min(TICKET_CONCURRENCY, ids.length) }, async () => {
      while (!cancelled && cursor < ids.length) {
        const fileId = ids[cursor]
        cursor += 1
        try {
          const ticket = await cloudGetDownloadTicket(providerId, fileId)
          if (!cancelled) {
            setUrlMap(m => ({ ...m, [fileId]: ticket.url }))
          }
        } catch {
          if (!cancelled) {
            setFailMap(m => ({ ...m, [fileId]: true }))
          }
        }
      }
    })
    void Promise.all(workers)
    return () => {
      cancelled = true
    }
  }, [providerId, photos])

  const openPreview = useCallback(
    (fileId: string) => {
      const idx = photos.findIndex(p => p.fileId === fileId)
      if (idx >= 0) setPreviewIdx(idx)
    },
    [photos]
  )

  const stepPreview = useCallback(
    (delta: number) => {
      setPreviewIdx(prev => {
        if (prev == null) return prev
        return Math.min(photos.length - 1, Math.max(0, prev + delta))
      })
    },
    [photos]
  )

  const previewPhoto = previewIdx != null ? photos[previewIdx] : null
  const previewUrl = previewPhoto ? urlMap[previewPhoto.fileId] : undefined

  useEffect(() => {
    if (previewIdx == null) return undefined
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') stepPreview(1)
      else if (e.key === 'ArrowLeft') stepPreview(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewIdx, stepPreview])

  const emptyAll = folders.length === 0 && photos.length === 0

  return (
    <div className="cloud-photo-view">
      {emptyAll ? (
        <Empty description={loading ? '正在加载…' : '此目录没有照片'} />
      ) : (
        <>
          {folders.length > 0 && (
            <div className="cloud-photo-folders">
              {folders.map(f => (
                <button
                  key={f.fileId}
                  type="button"
                  className="cloud-photo-folder"
                  title={`进入文件夹：${f.name}`}
                  onClick={() => onEnterFolder(f)}
                >
                  <FolderOutlined className="cloud-photo-folder__icon" />
                  <span className="cloud-photo-folder__name">{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {photos.length > 0 ? (
            <>
              <div className="cloud-photo-info">
                <span>
                  共 {photos.length} 张照片
                  {hiddenFiles > 0 && `（另有 ${hiddenFiles} 个非图片文件，可切换到列表查看）`}
                </span>
              </div>
              <div className="cloud-photo-grid">
                {photos.map(p => {
                  const url = urlMap[p.fileId]
                  const failed = failMap[p.fileId]
                  return (
                    <button
                      key={p.fileId}
                      type="button"
                      className={`cloud-photo-tile${url ? ' has-img' : ''}${failed ? ' is-failed' : ''}`}
                      title={p.name}
                      disabled={!url}
                      onClick={() => url && openPreview(p.fileId)}
                    >
                      {url ? (
                        <img className="cloud-photo-tile__img" src={url} alt={p.name} loading="lazy" />
                      ) : (
                        <span className="cloud-photo-tile__placeholder">
                          {failed ? <PictureOutlined /> : <Spin size="small" />}
                        </span>
                      )}
                      <span className="cloud-photo-tile__name">{p.name}</span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <Empty description="此目录没有照片（可在列表视图中查看全部文件）" />
          )}

          {loading && (
            <div className="cloud-photo-view__loading">
              <Spin size="small" />
              <span>正在加载…</span>
            </div>
          )}
        </>
      )}

      <Modal
        open={previewIdx != null}
        onCancel={() => setPreviewIdx(null)}
        footer={null}
        closable={false}
        width={Math.min(typeof window !== 'undefined' ? window.innerWidth - 48 : 1200, 1280)}
        styles={{ body: { padding: 0 } }}
      >
        {previewPhoto && (
          <div className="cloud-photo-lightbox" onClick={e => e.target === e.currentTarget && setPreviewIdx(null)}>
            {previewUrl ? (
              <img
                className="cloud-photo-lightbox__img"
                key={previewPhoto.fileId}
                src={previewUrl}
                alt={previewPhoto.name}
              />
            ) : (
              <div className="cloud-photo-lightbox__loading">
                <Spin size="large" />
              </div>
            )}

            <button
              type="button"
              className="cloud-photo-lightbox__close"
              onClick={() => setPreviewIdx(null)}
              aria-label="关闭"
            >
              <CloseOutlined />
            </button>

            {previewIdx != null && previewIdx > 0 && (
              <button
                type="button"
                className="cloud-photo-lightbox__arrow is-prev"
                onClick={() => stepPreview(-1)}
                aria-label="上一张"
              >
                <LeftOutlined />
              </button>
            )}
            {previewIdx != null && previewIdx < photos.length - 1 && (
              <button
                type="button"
                className="cloud-photo-lightbox__arrow is-next"
                onClick={() => stepPreview(1)}
                aria-label="下一张"
              >
                <RightOutlined />
              </button>
            )}

            <div className="cloud-photo-lightbox__caption">
              <span className="cloud-photo-lightbox__name">{previewPhoto.name}</span>
              <span className="cloud-photo-lightbox__counter">
                {(previewIdx ?? 0) + 1} / {photos.length}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default CloudPhotoGrid
