import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Breadcrumb, Button, Checkbox, Empty, Input, Space, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, FolderOutlined, PictureOutlined } from '@ant-design/icons'
import {
  formatAuthApiError,
  getOrCreatePickerClientId,
  shareBrowsePublic,
  shareGetPublic,
  sharePresignGetPublic,
  shareSubmitSelection,
  type ShareBrowseResult,
  type SharePublicMeta,
} from '../utils'
import ImagePreview from './ImagePreview/ImagePreview'

const GRID_ITEM_STYLE: React.CSSProperties = {
  position: 'relative',
  borderRadius: 12,
  padding: 8,
  background: 'rgba(255, 255, 255, 0.55)',
  border: '1px solid rgba(0, 0, 0, 0.06)',
}

const GRID_THUMB_SHELL_STYLE: React.CSSProperties = {
  width: '100%',
  aspectRatio: '1',
  borderRadius: 10,
  overflow: 'hidden',
  background: 'rgba(0, 0, 0, 0.04)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 6,
}

const PREVIEW_THUMB_IMG_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

function isImageKey(key: string): boolean {
  const ext = (key.split('.').pop() || '').toLowerCase()
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)
}

const ShareBrowseThumb: React.FC<{
  token: string
  cosKey: string
  title: string
  onOpenPreview: () => void
}> = ({ token, cosKey, title, onOpenPreview }) => {
  const shellRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const fullTriedRef = useRef(false)

  useEffect(() => {
    fullTriedRef.current = false
    setUrl(null)
    setFailed(false)
    const el = shellRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        obs.disconnect()
        void (async () => {
          try {
            const { previewUrl } = await sharePresignGetPublic(token, { key: cosKey, variant: 'thumb' })
            setUrl(previewUrl)
          } catch {
            setFailed(true)
          }
        })()
      },
      { rootMargin: '120px', threshold: 0.02 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [token, cosKey])

  const onThumbImgError = () => {
    if (fullTriedRef.current) {
      setFailed(true)
      return
    }
    fullTriedRef.current = true
    void (async () => {
      try {
        const { previewUrl } = await sharePresignGetPublic(token, { key: cosKey, variant: 'full' })
        setUrl(previewUrl)
      } catch {
        setFailed(true)
      }
    })()
  }

  return (
    <div
      ref={shellRef}
      role="button"
      tabIndex={0}
      onClick={onOpenPreview}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenPreview()
        }
      }}
      style={{ ...GRID_THUMB_SHELL_STYLE, cursor: 'pointer' }}
      aria-label={`预览 ${title}`}
    >
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          style={PREVIEW_THUMB_IMG_STYLE}
          onError={onThumbImgError}
        />
      ) : failed ? (
        <PictureOutlined style={{ fontSize: 28, opacity: 0.45 }} />
      ) : (
        <Spin size="small" />
      )}
    </div>
  )
}

export interface CosShareViewTabProps {
  token: string
  onClose: () => void
}

const CosShareViewTab: React.FC<CosShareViewTabProps> = ({ token, onClose }) => {
  const { message } = App.useApp()
  const [meta, setMeta] = useState<SharePublicMeta | null>(null)
  const [browse, setBrowse] = useState<ShareBrowseResult | null>(null)
  const [currentPrefix, setCurrentPrefix] = useState('')
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [pickerLabel, setPickerLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectionEnabled = meta?.selectionEnabled === true && meta.resourceType === 'folder'

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const m = await shareGetPublic(token)
      setMeta(m)
      if (m.resourceType === 'folder') {
        const data = await shareBrowsePublic(token, currentPrefix || undefined)
        setBrowse(data)
      } else {
        setBrowse(null)
        const { previewUrl } = await sharePresignGetPublic(token, { variant: 'full' })
        setPreview({ url: previewUrl, title: m.displayName })
      }
    } catch (e: unknown) {
      setLoadError(formatAuthApiError(e))
      setMeta(null)
      setBrowse(null)
    } finally {
      setLoading(false)
    }
  }, [token, currentPrefix])

  useEffect(() => {
    void load()
  }, [load])

  const openPreview = useCallback(
    async (cosKey: string, title: string) => {
      try {
        const { previewUrl } = await sharePresignGetPublic(token, { key: cosKey, variant: 'full' })
        setPreview({ url: previewUrl, title })
      } catch (e: unknown) {
        message.error(formatAuthApiError(e))
      }
    },
    [token, message]
  )

  const toggleSelect = useCallback((cosKey: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(cosKey)
      else next.delete(cosKey)
      return next
    })
  }, [])

  const submitSelection = useCallback(async () => {
    if (selectedKeys.size === 0) {
      message.warning('请至少选择一张图片')
      return
    }
    setSubmitting(true)
    try {
      await shareSubmitSelection(token, {
        pickerClientId: getOrCreatePickerClientId(),
        pickerLabel: pickerLabel.trim() || undefined,
        keys: [...selectedKeys],
      })
      message.success(`已提交 ${selectedKeys.size} 张选片`)
      setSelectedKeys(new Set())
    } catch (e: unknown) {
      message.error(formatAuthApiError(e))
    } finally {
      setSubmitting(false)
    }
  }, [token, selectedKeys, pickerLabel, message])

  const folderRows = useMemo(() => {
    if (!browse) return []
    return browse.commonPrefixes.map((p) => {
      const label = p.replace(/\/$/, '').split('/').filter(Boolean).pop() || p
      return { key: p, prefix: p, label }
    })
  }, [browse])

  const imageRows = useMemo(() => {
    if (!browse) return []
    return browse.objects
      .filter((o) => isImageKey(o.key))
      .map((o) => {
        const name = o.key.split('/').filter(Boolean).pop() || o.key
        return { key: o.key, cosKey: o.key, name }
      })
  }, [browse])

  const breadcrumbItems = useMemo(() => {
    const items: { title: React.ReactNode }[] = [
      {
        title: (
          <button
            type="button"
            onClick={() => setCurrentPrefix('')}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
          >
            {meta?.displayName ?? '分享'}
          </button>
        ),
      },
    ]
    if (!currentPrefix) return items
    const parts = currentPrefix.replace(/\/$/, '').split('/').filter(Boolean)
    let acc = ''
    for (const part of parts) {
      acc = `${acc}${part}/`
      const captured = acc
      items.push({
        title: (
          <button
            type="button"
            onClick={() => setCurrentPrefix(captured)}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}
          >
            {part}
          </button>
        ),
      })
    }
    return items
  }, [meta?.displayName, currentPrefix])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(245, 245, 247, 0.96)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
      }}
    >
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={onClose}>
          关闭
        </Button>
        {meta && (
          <>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {meta.displayName}
            </Typography.Title>
            <Tag>{meta.resourceType === 'folder' ? '文件夹' : '单文件'}</Tag>
            {selectionEnabled && <Tag color="blue">选片反馈已开启</Tag>}
            <Typography.Text type="secondary">来自 {meta.ownerDisplayName}</Typography.Text>
          </>
        )}
      </Space>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : loadError ? (
        <Empty description={loadError} />
      ) : meta?.resourceType === 'file' ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography.Text type="secondary">单文件分享已打开预览</Typography.Text>
        </div>
      ) : (
        <>
          <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 12 }} />
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: selectionEnabled ? 72 : 0 }}>
            {folderRows.length === 0 && imageRows.length === 0 ? (
              <Empty description="文件夹为空" />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
                  gap: 12,
                }}
              >
                {folderRows.map((row) => (
                  <div key={row.key} style={GRID_ITEM_STYLE}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setCurrentPrefix(row.prefix)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setCurrentPrefix(row.prefix)
                        }
                      }}
                      style={{ ...GRID_THUMB_SHELL_STYLE, cursor: 'pointer' }}
                    >
                      <FolderOutlined style={{ fontSize: 36, color: 'rgba(0, 122, 255, 0.85)' }} />
                    </div>
                    <Typography.Text ellipsis title={row.label} style={{ display: 'block', fontSize: 12 }}>
                      {row.label}
                    </Typography.Text>
                  </div>
                ))}
                {imageRows.map((row) => (
                  <div key={row.key} style={GRID_ITEM_STYLE}>
                    {selectionEnabled && (
                      <Checkbox
                        checked={selectedKeys.has(row.cosKey)}
                        onChange={(e) => toggleSelect(row.cosKey, e.target.checked)}
                        style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <ShareBrowseThumb
                      token={token}
                      cosKey={row.cosKey}
                      title={row.name}
                      onOpenPreview={() => void openPreview(row.cosKey, row.name)}
                    />
                    <Typography.Text ellipsis title={row.name} style={{ display: 'block', fontSize: 12 }}>
                      {row.name}
                    </Typography.Text>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectionEnabled && (
            <div
              style={{
                position: 'fixed',
                left: 24,
                right: 24,
                bottom: 24,
                padding: '12px 16px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.92)',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                zIndex: 1001,
              }}
            >
              <Typography.Text>已选 {selectedKeys.size} 张</Typography.Text>
              <Input
                placeholder="昵称（可选）"
                value={pickerLabel}
                onChange={(e) => setPickerLabel(e.target.value)}
                maxLength={64}
                style={{ width: 160 }}
              />
              <Button type="primary" loading={submitting} onClick={() => void submitSelection()}>
                提交选片
              </Button>
            </div>
          )}
        </>
      )}

      <ImagePreview visible={!!preview} image={preview?.url} onClose={() => setPreview(null)} />
    </div>
  )
}

export default CosShareViewTab
