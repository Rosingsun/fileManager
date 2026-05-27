import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Breadcrumb,
  Button,
  Checkbox,
  Empty,
  Input,
  Modal,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import { ArrowLeftOutlined, FolderOutlined, PictureOutlined, StarFilled } from '@ant-design/icons'
import {
  formatAuthApiError,
  getOrCreatePickerClientId,
  shareBrowsePublic,
  shareGetPublic,
  sharePresignGetPublic,
  shareSubmitSelection,
  loadStoredPicks,
  saveStoredPicks,
  clearStoredPicks,
  picksToSubmitItems,
  SELECTION_TIER_COLORS,
  SELECTION_TIER_LABELS,
  type ShareBrowseResult,
  type SharePublicMeta,
  type SelectionPickState,
  type SelectionTier,
} from '../utils'
import ImagePreview from './ImagePreview/ImagePreview'
import './cos-share-view.css'

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
  originalKey?: string
  title: string
  onOpenPreview: () => void
}> = ({ token, cosKey, originalKey, title, onOpenPreview }) => {
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
            const { previewUrl } = await sharePresignGetPublic(token, {
              key: cosKey,
              originalKey,
              variant: 'thumb',
            })
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
  }, [token, cosKey, originalKey])

  const onThumbImgError = () => {
    if (fullTriedRef.current) {
      setFailed(true)
      return
    }
    fullTriedRef.current = true
    void (async () => {
      try {
        const { previewUrl } = await sharePresignGetPublic(token, {
          key: cosKey,
          originalKey,
          variant: 'full',
        })
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

type GridTab = 'all' | 'recommended'

const CosShareViewTab: React.FC<CosShareViewTabProps> = ({ token, onClose }) => {
  const { message } = App.useApp()
  const [meta, setMeta] = useState<SharePublicMeta | null>(null)
  const [browse, setBrowse] = useState<ShareBrowseResult | null>(null)
  const [currentPrefix, setCurrentPrefix] = useState('')
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<{
    url: string
    title: string
    cosKey: string
    originalKey?: string
  } | null>(null)
  const [compareOriginalUrl, setCompareOriginalUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [picks, setPicks] = useState<Record<string, SelectionPickState>>(() => loadStoredPicks(token))
  const [pickerLabel, setPickerLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [gridTab, setGridTab] = useState<GridTab>('all')
  const [activeTier, setActiveTier] = useState<SelectionTier>('must')
  const [noteDraft, setNoteDraft] = useState('')

  const selectionEnabled = meta?.selectionEnabled === true && meta.resourceType === 'folder'
  const recommendedSet = useMemo(() => new Set(meta?.recommendedKeys ?? browse?.recommendedKeys ?? []), [meta, browse])

  useEffect(() => {
    saveStoredPicks(token, picks)
  }, [token, picks])

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
        setPreview({ url: previewUrl, title: m.displayName, cosKey: '' })
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

  const setPick = useCallback((cosKey: string, tier: SelectionTier | null, note?: string) => {
    setPicks((prev) => {
      const next = { ...prev }
      if (!tier) {
        delete next[cosKey]
        return next
      }
      next[cosKey] = {
        cosKey,
        tier,
        note: note ?? next[cosKey]?.note ?? '',
      }
      return next
    })
  }, [])

  const openPreview = useCallback(
    async (cosKey: string, title: string, originalKey?: string) => {
      try {
        const { previewUrl } = await sharePresignGetPublic(token, {
          key: cosKey,
          originalKey,
          variant: 'full',
        })
        setPreview({ url: previewUrl, title, cosKey, originalKey })
        const existing = picks[cosKey]
        setNoteDraft(existing?.note ?? '')
        setActiveTier(existing?.tier ?? 'must')
        setCompareOriginalUrl(null)
      } catch (e: unknown) {
        message.error(formatAuthApiError(e))
      }
    },
    [token, message, picks]
  )

  const loadCompareOriginal = useCallback(async () => {
    if (!preview?.originalKey || preview.originalKey === preview.cosKey) return
    try {
      const { previewUrl } = await sharePresignGetPublic(token, {
        key: preview.originalKey,
        variant: 'full',
      })
      setCompareOriginalUrl(previewUrl)
    } catch (e: unknown) {
      message.error(formatAuthApiError(e))
    }
  }, [preview, token, message])

  const submitSelection = useCallback(async () => {
    const items = picksToSubmitItems(picks)
    if (items.length === 0) {
      message.warning('请至少选择一张图片')
      return
    }
    setSubmitting(true)
    try {
      await shareSubmitSelection(token, {
        pickerClientId: getOrCreatePickerClientId(),
        pickerLabel: pickerLabel.trim() || undefined,
        selectionRound: meta?.selectionRound,
        items,
      })
      message.success(`已提交 ${items.length} 张选片`)
      setPicks({})
      clearStoredPicks(token)
    } catch (e: unknown) {
      message.error(formatAuthApiError(e))
    } finally {
      setSubmitting(false)
    }
  }, [token, picks, pickerLabel, meta?.selectionRound, message])

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
        const cosKey = o.originalKey ?? o.key
        return {
          key: o.key,
          cosKey,
          displayKey: o.displayKey ?? o.key,
          originalKey: o.originalKey ?? o.key,
          name,
          recommended: o.recommended === true || recommendedSet.has(o.key) || recommendedSet.has(cosKey),
        }
      })
      .filter((row) => gridTab !== 'recommended' || row.recommended)
  }, [browse, gridTab, recommendedSet])

  const pickCounts = useMemo(() => {
    const counts = { must: 0, maybe: 0, reject: 0 }
    for (const p of Object.values(picks)) {
      counts[p.tier] += 1
    }
    return counts
  }, [picks])

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
    <div className="cos-share-view-root">
      <Space className="cos-share-view-toolbar" wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={onClose}>
          关闭
        </Button>
        {meta && (
          <>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {meta.displayName}
            </Typography.Title>
            <Tag>{meta.resourceType === 'folder' ? '文件夹' : '单文件'}</Tag>
            {selectionEnabled && (
              <>
                <Tag color="blue">选片反馈</Tag>
                <Tag>第 {meta.selectionRound} 轮</Tag>
              </>
            )}
            {meta.assetVariant === 'edited' && <Tag color="purple">精修版</Tag>}
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
          {selectionEnabled && recommendedSet.size > 0 && (
            <Segmented
              size="small"
              value={gridTab}
              onChange={(v) => setGridTab(v as GridTab)}
              options={[
                { label: '全部', value: 'all' },
                { label: `摄影师推荐 (${recommendedSet.size})`, value: 'recommended' },
              ]}
              style={{ marginBottom: 12 }}
            />
          )}
          <div className={`cos-share-view-scroll${selectionEnabled ? '' : ''}`}>
            {folderRows.length === 0 && imageRows.length === 0 ? (
              <Empty description="文件夹为空" />
            ) : (
              <div className="cos-share-view-grid">
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
                {imageRows.map((row) => {
                  const pick = picks[row.cosKey]
                  return (
                    <div key={row.key} style={GRID_ITEM_STYLE}>
                      {row.recommended && (
                        <StarFilled
                          style={{
                            position: 'absolute',
                            top: 10,
                            right: selectionEnabled ? 36 : 10,
                            color: '#ff9f0a',
                            fontSize: 14,
                            zIndex: 2,
                          }}
                        />
                      )}
                      {pick && (
                        <span
                          className="cos-share-tier-badge"
                          style={{ background: SELECTION_TIER_COLORS[pick.tier] }}
                        >
                          {SELECTION_TIER_LABELS[pick.tier]}
                        </span>
                      )}
                      {selectionEnabled && (
                        <Checkbox
                          checked={!!pick}
                          onChange={(e) => {
                            if (e.target.checked) setPick(row.cosKey, activeTier)
                            else setPick(row.cosKey, null)
                          }}
                          style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <ShareBrowseThumb
                        token={token}
                        cosKey={row.displayKey}
                        originalKey={row.originalKey}
                        title={row.name}
                        onOpenPreview={() => void openPreview(row.displayKey, row.name, row.originalKey)}
                      />
                      <Typography.Text ellipsis title={row.name} style={{ display: 'block', fontSize: 12 }}>
                        {row.name}
                      </Typography.Text>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {selectionEnabled && (
            <div className="cos-share-view-bottom-bar">
              <Segmented
                size="small"
                value={activeTier}
                onChange={(v) => setActiveTier(v as SelectionTier)}
                options={[
                  { label: '必选', value: 'must' },
                  { label: '备选', value: 'maybe' },
                  { label: '淘汰', value: 'reject' },
                ]}
              />
              <Typography.Text style={{ fontSize: 12 }}>
                已选 {pickCounts.must + pickCounts.maybe + pickCounts.reject}（必{pickCounts.must} 备
                {pickCounts.maybe} 淘{pickCounts.reject}）
              </Typography.Text>
              <Input
                placeholder="昵称（可选）"
                value={pickerLabel}
                onChange={(e) => setPickerLabel(e.target.value)}
                maxLength={64}
                style={{ width: 120, flex: '1 1 120px' }}
              />
              <Button type="primary" loading={submitting} onClick={() => void submitSelection()}>
                提交选片
              </Button>
            </div>
          )}
        </>
      )}

      {!selectionEnabled && (
        <ImagePreview
          visible={!!preview}
          image={preview?.url}
          onClose={() => setPreview(null)}
        />
      )}

      <Modal
        title={preview?.title}
        open={!!preview && selectionEnabled}
        onCancel={() => setPreview(null)}
        footer={[
          meta?.assetVariant === 'edited' && preview?.originalKey ? (
            <Button
              key="compare"
              onMouseDown={() => void loadCompareOriginal()}
              onMouseUp={() => setCompareOriginalUrl(null)}
              onTouchStart={() => void loadCompareOriginal()}
              onTouchEnd={() => setCompareOriginalUrl(null)}
            >
              按住看原图
            </Button>
          ) : null,
          <Button
            key="must"
            type={activeTier === 'must' ? 'primary' : 'default'}
            onClick={() => {
              if (preview) {
                setPick(preview.cosKey, 'must', noteDraft)
                message.success('已标为必选')
              }
            }}
          >
            必选
          </Button>,
          <Button
            key="maybe"
            onClick={() => {
              if (preview) {
                setPick(preview.cosKey, 'maybe', noteDraft)
                message.success('已标为备选')
              }
            }}
          >
            备选
          </Button>,
          <Button
            key="reject"
            danger
            onClick={() => {
              if (preview) {
                setPick(preview.cosKey, 'reject', noteDraft)
                message.success('已标为淘汰')
              }
            }}
          >
            淘汰
          </Button>,
        ].filter(Boolean)}
      >
        {preview?.url && (
          <img
            src={compareOriginalUrl ?? preview.url}
            alt=""
            style={{ width: '100%', maxHeight: '50vh', objectFit: 'contain', marginBottom: 12, borderRadius: 8 }}
          />
        )}
        <Input.TextArea
          placeholder="备注（可选）"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          maxLength={512}
          rows={2}
        />
      </Modal>
    </div>
  )
}

export default CosShareViewTab
