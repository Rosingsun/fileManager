import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  Dropdown,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Progress,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Badge,
  TreeSelect,
  Typography,
} from 'antd'
import type { MenuProps } from 'antd'
import type { DataNode } from 'antd/es/tree'
import {
  CloudUploadOutlined,
  FolderAddOutlined,
  FolderOutlined,
  FormOutlined,
  LinkOutlined,
  PictureOutlined,
  DeleteOutlined,
  SwapOutlined,
  ArrowLeftOutlined,
  MoreOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons'
import {
  cosBrowse,
  cosDelete,
  cosDeleteFolder,
  cosMkdir,
  cosMove,
  cosMoveFolder,
  cosPresignGet,
  cosRenameFolder,
  formatAuthApiError,
  formatFileSize,
  AuthApiError,
  shareCreate,
  shareUpdateMeta,
  copyShareLink,
  buildShareDeepLink,
  shareSelectionsByFolderPrefix,
  shareSelectionSummary,
  shareSelectionRemapKeys,
  getSelectionLastSeenMs,
  formatDateTime,
  type CosBrowseResult,
  type SharePermission,
  type ShareWithSelectionMeta,
} from '../utils'
import {
  useCosImageUpload,
  formatCosImageUploadSpeed,
} from '../hooks'
import ShareOpenModal from './ShareOpenModal'
import CosSelectionDrawer from './CosSelectionDrawer'

type FolderMoveTreeNode = DataNode & { value?: string }

const COS_PREVIEW_MODAL_IMG_STYLE: React.CSSProperties = {
  maxWidth: '100%',
  maxHeight: 'min(64vh, 520px)',
  width: 'auto',
  height: 'auto',
  display: 'block',
  margin: '0 auto',
  objectFit: 'contain',
}

const COS_PREVIEW_THUMB_IMG_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}

const IMG_RE = /\.(jpe?g|png|gif|webp)$/i

function isImageKey(key: string): boolean {
  return IMG_RE.test(key.split('/').pop() || '')
}

function basename(key: string): string {
  const seg = key.split('/').filter(Boolean)
  return seg.length ? seg[seg.length - 1]! : key
}

const PRESIGN_CAP = 6
let presignBusy = 0

async function withPresignConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  while (presignBusy >= PRESIGN_CAP) {
    await new Promise<void>((r) => setTimeout(r, 32))
  }
  presignBusy += 1
  try {
    return await fn()
  } finally {
    presignBusy -= 1
  }
}

const COS_GRID_ITEM_STYLE: React.CSSProperties = {
  position: 'relative',
  borderRadius: 12,
  padding: 8,
  background: 'rgba(255, 255, 255, 0.55)',
  border: '1px solid rgba(0, 0, 0, 0.06)',
}

const COS_GRID_THUMB_SHELL_STYLE: React.CSSProperties = {
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

const COS_GRID_ITEM_MORE_BTN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 2,
  right: 2,
}

const CosBrowseThumb: React.FC<{
  cosKey: string
  title: string
  onOpenPreview: () => void
}> = ({ cosKey, title, onOpenPreview }) => {
  const shellRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const runRef = useRef(0)
  const fullFallbackRef = useRef(false)

  useEffect(() => {
    runRef.current += 1
    const runId = runRef.current
    fullFallbackRef.current = false
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
            const { previewUrl } = await withPresignConcurrency(() =>
              cosPresignGet({ key: cosKey, variant: 'thumb' })
            )
            if (runRef.current === runId) setUrl(previewUrl)
          } catch {
            if (runRef.current === runId) setFailed(true)
          }
        })()
      },
      { rootMargin: '120px', threshold: 0.02 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [cosKey])

  const onThumbImgError = () => {
    if (fullFallbackRef.current) {
      setFailed(true)
      return
    }
    fullFallbackRef.current = true
    void (async () => {
      try {
        const { previewUrl } = await withPresignConcurrency(() =>
          cosPresignGet({ key: cosKey, variant: 'full' })
        )
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
      style={{ ...COS_GRID_THUMB_SHELL_STYLE, cursor: 'pointer' }}
      aria-label={`预览 ${title}`}
    >
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          style={COS_PREVIEW_THUMB_IMG_STYLE}
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

function normalizeRelDir(p: string): string {
  const s = p.trim().replace(/^\/+/, '')
  if (!s) return ''
  const raw = s.split('/').filter((x) => x.length > 0)
  if (raw.some((x) => x === '..')) return ''
  const parts = raw.filter((x) => x !== '.')
  return parts.length ? `${parts.join('/')}/` : ''
}

function joinObjectKey(scopePrefix: string, parentRel: string, fileName: string): string {
  const dir = normalizeRelDir(parentRel)
  return `${scopePrefix}${dir}${fileName}`
}

const FOLDER_MOVE_TREE_ROOT_KEY = '__root__'

function ensureRelFolderPrefix(rel: string): string {
  const s = (rel || '').trim()
  if (!s) return ''
  return s.endsWith('/') ? s : `${s}/`
}

/** 选择 `parentRel` 作为目标父目录时，是否会导致移入自身或无效路径（与后端 `move-folder` 一致） */
function isInvalidMoveParent(parentRelRaw: string, movingFolderRelRaw: string): boolean {
  const p = normalizeRelDir(parentRelRaw ?? '')
  const m = ensureRelFolderPrefix(movingFolderRelRaw)
  const name = basename(m.replace(/\/$/, ''))
  if (!name) return true
  const toRel = `${p}${name}/`
  return toRel === m || toRel.startsWith(m)
}

function expandKeysForParentRel(parentRelNormalized: string): React.Key[] {
  const keys: React.Key[] = [FOLDER_MOVE_TREE_ROOT_KEY]
  if (!parentRelNormalized) return keys
  const parts = parentRelNormalized.replace(/\/$/, '').split('/').filter(Boolean)
  let acc = ''
  for (const p of parts) {
    acc = `${acc}${p}/`
    keys.push(acc)
  }
  return keys
}

function updateFolderTreeChildren<T extends FolderMoveTreeNode>(list: T[], key: React.Key, children: T[]): T[] {
  return list.map((node) => {
    if (node.key === key) {
      return { ...node, children, isLeaf: children.length === 0 }
    }
    if (node.children) {
      return { ...node, children: updateFolderTreeChildren(node.children as T[], key, children) }
    }
    return node
  })
}

export interface CosImageLibraryTabProps {
  embedded?: boolean
  onBackToLocalFiles?: () => void
  onOpenShareView?: (token: string) => void
}

const CosImageLibraryTab: React.FC<CosImageLibraryTabProps> = ({ embedded, onBackToLocalFiles, onOpenShareView }) => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [browse, setBrowse] = useState<CosBrowseResult | null>(null)
  const [currentPrefix, setCurrentPrefix] = useState('')
  const [cosDisabled, setCosDisabled] = useState(false)
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)
  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveFromKey, setMoveFromKey] = useState<string | null>(null)
  const [mkdirForm] = Form.useForm<{ name: string }>()
  const [renameFolderForm] = Form.useForm<{ newName: string }>()
  const [renameFolderOpen, setRenameFolderOpen] = useState(false)
  const [renameFolderFromKey, setRenameFolderFromKey] = useState<string | null>(null)
  const [renameFolderOldRelPrefix, setRenameFolderOldRelPrefix] = useState<string | null>(null)
  const [folderMoveOpen, setFolderMoveOpen] = useState(false)
  const [folderMoveFromKey, setFolderMoveFromKey] = useState<string | null>(null)
  const [folderMoveOldRelPrefix, setFolderMoveOldRelPrefix] = useState<string | null>(null)
  const [folderMoveForm] = Form.useForm<{ targetParentPrefix?: string }>()
  const [folderMoveTreeData, setFolderMoveTreeData] = useState<FolderMoveTreeNode[]>([])
  const [folderMoveTreeExpandedKeys, setFolderMoveTreeExpandedKeys] = useState<React.Key[]>([])
  const folderMoveSourceRelRef = useRef<string>('')
  const folderMoveTreeLoadedKeysRef = useRef<Set<string>>(new Set())
  const [moveForm] = Form.useForm<{ parentPrefix: string; newFileName: string }>()
  const [shareOpen, setShareOpen] = useState(false)
  const [shareSubmitting, setShareSubmitting] = useState(false)
  const [shareResultToken, setShareResultToken] = useState<string | null>(null)
  const [shareTarget, setShareTarget] = useState<
    | { resourceType: 'file'; key: string; name: string }
    | { resourceType: 'folder'; prefix: string; name: string }
    | null
  >(null)
  const [shareForm] = Form.useForm<{
    permission: SharePermission
    expiresInHours: number
    selectionEnabled: boolean
    selectionRound: number
    assetVariant: 'original' | 'edited'
    hideQualityFailed: boolean
  }>()
  const [shareOpenInputVisible, setShareOpenInputVisible] = useState(false)
  const [activeSelectionShare, setActiveSelectionShare] = useState<ShareWithSelectionMeta | null>(null)
  const [pickCountByKey, setPickCountByKey] = useState<Record<string, number>>({})
  const [showPickedOnly, setShowPickedOnly] = useState(false)
  const [selectionDrawerOpen, setSelectionDrawerOpen] = useState(false)
  const [latestSubmissionAt, setLatestSubmissionAt] = useState(0)
  const [recommendedEditing, setRecommendedEditing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await cosBrowse(currentPrefix || undefined, '/')
      setBrowse(data)
      setCosDisabled(false)
    } catch (e: unknown) {
      if (e instanceof AuthApiError && e.code === 'COS_NOT_CONFIGURED') {
        setCosDisabled(true)
        setBrowse(null)
      } else {
        message.error(formatAuthApiError(e))
      }
    } finally {
      setLoading(false)
    }
  }, [currentPrefix, message])

  useEffect(() => {
    void load()
  }, [load])

  const scopePrefix = browse?.scopePrefix ?? ''

  const {
    fileInputRef,
    uploadModalOpen,
    uploadTasks,
    uploadDropActive,
    uploadScanning,
    autoUploadAfterSelect,
    setAutoUploadAfterSelect,
    sortByCategoryOnUpload,
    setSortByCategoryOnUpload,
    isUploading,
    pendingCount,
    errorCount,
    uploadDropZoneBusy,
    openUploadModal,
    closeUploadModal,
    onUploadFileInputChange,
    onUploadDropZoneDragOver,
    onUploadDropZoneDragLeave,
    onUploadDropZoneDrop,
    onUploadDropZoneClick,
    onUploadDropZoneKeyDown,
    removeUploadTask,
    clearPendingUploads,
    retryUploadTask,
    retryAllFailed,
    startUploads,
    primaryUploadButtonLabel,
    handleMainCardDragOver,
    handleMainCardDrop,
  } = useCosImageUpload({
    message,
    currentPrefix,
    scopePrefix,
    onAfterBatchUpload: () => void load(),
  })

  const loadSelectionFeedback = useCallback(async () => {
    const folderKey = `${scopePrefix}${currentPrefix || ''}`
    if (!scopePrefix || !folderKey.endsWith('/')) {
      setActiveSelectionShare(null)
      setPickCountByKey({})
      return
    }
    try {
      const { shares } = await shareSelectionsByFolderPrefix(folderKey)
      const share = shares[0] ?? null
      setActiveSelectionShare(share)
      if (!share) {
        setPickCountByKey({})
        return
      }
      const summary = await shareSelectionSummary(share.id)
      const map: Record<string, number> = {}
      for (const p of summary.picks) {
        map[p.cosKey] = p.pickCount
      }
      setPickCountByKey(map)
      if (summary.picks.length > 0) {
        const maxAt = Math.max(...summary.picks.map((p) => p.lastSubmittedAt))
        setLatestSubmissionAt(maxAt)
      } else {
        setLatestSubmissionAt(0)
      }
    } catch {
      setActiveSelectionShare(null)
      setPickCountByKey({})
      setLatestSubmissionAt(0)
    }
  }, [scopePrefix, currentPrefix])

  useEffect(() => {
    if (cosDisabled || !scopePrefix) return
    void loadSelectionFeedback()
    const timer = window.setInterval(() => void loadSelectionFeedback(), 60_000)
    return () => clearInterval(timer)
  }, [loadSelectionFeedback, cosDisabled, scopePrefix, browse])

  const hasUnseenSelection =
    activeSelectionShare != null &&
    latestSubmissionAt > getSelectionLastSeenMs(activeSelectionShare.id)

  const openSelectionDrawer = useCallback(() => {
    if (!activeSelectionShare) return
    setSelectionDrawerOpen(true)
  }, [activeSelectionShare])

  const toggleRecommendedKey = useCallback(
    async (cosKey: string) => {
      if (!activeSelectionShare) return
      const set = new Set(activeSelectionShare.recommendedKeys ?? [])
      if (set.has(cosKey)) set.delete(cosKey)
      else set.add(cosKey)
      try {
        const updated = await shareUpdateMeta({
          shareId: activeSelectionShare.id,
          recommendedKeys: [...set],
        })
        if (updated) {
          setActiveSelectionShare({
            ...activeSelectionShare,
            ...updated,
            submissionCount: activeSelectionShare.submissionCount,
          })
        }
        message.success(set.has(cosKey) ? '已加入推荐' : '已取消推荐')
      } catch (e: unknown) {
        message.error(formatAuthApiError(e))
      }
    },
    [activeSelectionShare, message]
  )

  const folderRows = useMemo(() => {
    const pfxs = browse?.commonPrefixes ?? []
    return pfxs.map((p) => ({
      key: `dir:${p}`,
      kind: 'folder' as const,
      label: basename(p.endsWith('/') ? p.slice(0, -1) : p) || p,
      prefix: p,
    }))
  }, [browse?.commonPrefixes])

  const imageRows = useMemo(() => {
    const objs = browse?.objects ?? []
    return objs
      .filter((o) => isImageKey(o.key))
      .map((o) => ({
        key: o.key,
        kind: 'image' as const,
        name: basename(o.key),
        size: o.size,
        lastModified: o.lastModified,
        cosKey: o.key,
        pickCount: pickCountByKey[o.key] ?? 0,
      }))
      .filter((row) => !showPickedOnly || row.pickCount > 0)
  }, [browse?.objects, pickCountByKey, showPickedOnly])

  const openPreview = async (key: string, title: string) => {
    try {
      const { previewUrl } = await cosPresignGet({ key })
      setPreview({ url: previewUrl, title })
    } catch (e) {
      message.error(formatAuthApiError(e))
    }
  }

  const onDelete = (key: string) => {
    Modal.confirm({
      title: '删除该文件？',
      content: basename(key),
      okType: 'danger',
      onOk: async () => {
        try {
          await cosDelete({ key })
          message.success('已删除')
          void load()
        } catch (e) {
          message.error(formatAuthApiError(e))
        }
      },
    })
  }

  const openShareFile = (key: string, name: string) => {
    setShareTarget({ resourceType: 'file', key, name })
    setShareResultToken(null)
    shareForm.setFieldsValue({
      permission: 'read',
      expiresInHours: 168,
      selectionEnabled: false,
      selectionRound: 1,
      assetVariant: 'original',
      hideQualityFailed: false,
    })
    setShareOpen(true)
  }

  const openShareFolder = (fullKey: string, displayName: string) => {
    setShareTarget({ resourceType: 'folder', prefix: fullKey, name: displayName })
    setShareResultToken(null)
    shareForm.setFieldsValue({
      permission: 'read',
      expiresInHours: 168,
      selectionEnabled: false,
      selectionRound: 1,
      assetVariant: 'original',
      hideQualityFailed: false,
    })
    setShareOpen(true)
  }

  const submitShare = async () => {
    if (!shareTarget) return
    setShareSubmitting(true)
    try {
      const values = await shareForm.validateFields()
      const expiresInHours = values.expiresInHours === 0 ? null : values.expiresInHours
      const result = await shareCreate({
        resourceType: shareTarget.resourceType,
        key: shareTarget.resourceType === 'file' ? shareTarget.key : undefined,
        prefix: shareTarget.resourceType === 'folder' ? shareTarget.prefix : undefined,
        permission: values.permission,
        expiresInHours,
        selectionEnabled: shareTarget.resourceType === 'folder' ? values.selectionEnabled : false,
        selectionRound: values.selectionRound ?? 1,
        assetVariant: values.assetVariant ?? 'original',
        hideQualityFailed: values.hideQualityFailed ?? false,
      })
      setShareResultToken(result.token)
      message.success('分享链接已创建')
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setShareSubmitting(false)
    }
  }

  const relParentOfFolderPrefix = (relFolderPrefix: string): string => {
    const p = relFolderPrefix.replace(/\/+$/, '')
    if (!p) return ''
    const i = p.lastIndexOf('/')
    return i < 0 ? '' : `${p.slice(0, i + 1)}`
  }

  const onDeleteFolder = (fullKey: string, relFolderPrefix: string, displayName: string) => {
    Modal.confirm({
      title: '删除文件夹',
      content: `将删除文件夹「${displayName}」及其中的全部文件，是否继续？`,
      okText: '继续',
      okType: 'danger',
      onOk: () =>
        new Promise<void>((resolve, reject) => {
          window.setTimeout(() => {
            Modal.confirm({
              title: '再次确认',
              content: '此操作不可恢复。确定永久删除该文件夹及其中所有文件吗？',
              okText: '确定删除',
              okType: 'danger',
              onOk: async () => {
                try {
                  const r = await cosDeleteFolder({ key: fullKey })
                  message.success(
                    r.deleted > 0 ? `已删除文件夹（共 ${r.deleted} 个对象）` : '已删除文件夹'
                  )
                  setCurrentPrefix((prev) =>
                    prev === relFolderPrefix || prev.startsWith(relFolderPrefix)
                      ? relParentOfFolderPrefix(relFolderPrefix)
                      : prev
                  )
                  void load()
                  resolve()
                } catch (e) {
                  message.error(formatAuthApiError(e))
                  reject(e)
                }
              },
              onCancel: () => resolve(),
            })
          }, 0)
        }),
    })
  }

  const openMove = (key: string) => {
    const scope = browse?.scopePrefix
    if (!scope) return
    let relParent = ''
    if (key.startsWith(scope)) {
      const rest = key.slice(scope.length)
      const parts = rest.split('/').filter(Boolean)
      parts.pop()
      relParent = parts.length ? `${parts.join('/')}/` : ''
    }
    setMoveFromKey(key)
    moveForm.setFieldsValue({
      parentPrefix: relParent,
      newFileName: basename(key),
    })
    setMoveOpen(true)
  }

  const submitMove = async () => {
    if (!moveFromKey || !scopePrefix) return
    const v = await moveForm.validateFields()
    const parent = normalizeRelDir(v.parentPrefix || '')
    const name = (v.newFileName || '').trim()
    if (!name || name.includes('/') || name === '.' || name === '..') {
      message.error('文件名不合法')
      return
    }
    const toKey = joinObjectKey(scopePrefix, parent, name)
    try {
      const result = await cosMove({ fromKey: moveFromKey, toKey })
      const resolvedTo = result.key?.trim().replace(/^\/+/, '') || toKey
      if (activeSelectionShare) {
        await shareSelectionRemapKeys(activeSelectionShare.id, [
          { fromKey: moveFromKey, toKey: resolvedTo },
        ])
        void loadSelectionFeedback()
      }
      message.success('已移动')
      setMoveOpen(false)
      setMoveFromKey(null)
      void load()
    } catch (e) {
      message.error(formatAuthApiError(e))
    }
  }

  const submitMkdir = async () => {
    const v = await mkdirForm.validateFields()
    const name = (v.name || '').trim()
    if (!name) return
    try {
      await cosMkdir({ parentPrefix: currentPrefix || undefined, name })
      message.success('已创建文件夹')
      setMkdirOpen(false)
      mkdirForm.resetFields()
      void load()
    } catch (e) {
      message.error(formatAuthApiError(e))
    }
  }

  const openRenameFolder = (fullKey: string, relFolderPrefix: string, label: string) => {
    setRenameFolderFromKey(fullKey)
    setRenameFolderOldRelPrefix(relFolderPrefix)
    renameFolderForm.setFieldsValue({ newName: label })
    setRenameFolderOpen(true)
  }

  const submitRenameFolder = async () => {
    if (!renameFolderFromKey || !renameFolderOldRelPrefix) return
    const v = await renameFolderForm.validateFields()
    const name = (v.newName || '').trim()
    if (!name || name.includes('/') || name === '.' || name === '..') {
      message.error('文件夹名称不合法')
      return
    }
    try {
      await cosRenameFolder({ fromKey: renameFolderFromKey, newName: name })
      const parentRel = relParentOfFolderPrefix(renameFolderOldRelPrefix)
      const newRelPrefix = `${parentRel}${name}/`
      setCurrentPrefix((prev) =>
        prev.startsWith(renameFolderOldRelPrefix)
          ? newRelPrefix + prev.slice(renameFolderOldRelPrefix.length)
          : prev
      )
      message.success('已修改文件夹名称')
      setRenameFolderOpen(false)
      setRenameFolderFromKey(null)
      setRenameFolderOldRelPrefix(null)
      renameFolderForm.resetFields()
      void load()
    } catch (e) {
      message.error(formatAuthApiError(e))
    }
  }

  const initFolderMoveTree = useCallback(async (defaultParentNorm: string) => {
    const movingRel = folderMoveSourceRelRef.current
    try {
      const rootData = await cosBrowse(undefined, '/')
      const childPrefixes = rootData.commonPrefixes ?? []
      const level1: FolderMoveTreeNode[] = childPrefixes.map((cp) => ({
        title: basename(cp.replace(/\/$/, '')),
        value: cp,
        key: cp,
        disabled: isInvalidMoveParent(cp, movingRel),
        isLeaf: false,
      }))
      const rootDisabled = isInvalidMoveParent('', movingRel)
      let tree: FolderMoveTreeNode[] = [
        {
          title: '根目录',
          value: '',
          key: FOLDER_MOVE_TREE_ROOT_KEY,
          selectable: !rootDisabled,
          disabled: rootDisabled,
          isLeaf: level1.length === 0,
          children: level1,
        },
      ]

      const segs = defaultParentNorm.replace(/\/$/, '').split('/').filter(Boolean)
      if (segs.length > 1) {
        let cum = ''
        for (let i = 0; i < segs.length - 1; i++) {
          cum = `${cum}${segs[i]}/`
          if (folderMoveTreeLoadedKeysRef.current.has(cum)) continue
          const data = await cosBrowse(cum, '/')
          folderMoveTreeLoadedKeysRef.current.add(cum)
          const nextChildren: FolderMoveTreeNode[] = (data.commonPrefixes ?? []).map((cp) => ({
            title: basename(cp.replace(/\/$/, '')),
            value: cp,
            key: cp,
            disabled: isInvalidMoveParent(cp, movingRel),
            isLeaf: false,
          }))
          tree = updateFolderTreeChildren(tree, cum, nextChildren)
        }
      }

      setFolderMoveTreeData(tree)
    } catch (e) {
      message.error(formatAuthApiError(e))
      setFolderMoveTreeData([])
    }
  }, [message])

  const loadFolderMoveTreeChildren = useCallback(
    (treeNode: FolderMoveTreeNode) =>
      new Promise<void>((resolve, reject) => {
        const k = String(treeNode.key ?? '')
        if (k === FOLDER_MOVE_TREE_ROOT_KEY) {
          resolve()
          return
        }
        if (folderMoveTreeLoadedKeysRef.current.has(k)) {
          resolve()
          return
        }
        const movingRel = folderMoveSourceRelRef.current
        cosBrowse(k, '/')
          .then((data) => {
            folderMoveTreeLoadedKeysRef.current.add(k)
            const nextPrefixes = data.commonPrefixes ?? []
            const children: FolderMoveTreeNode[] = nextPrefixes.map((cp) => ({
              title: basename(cp.replace(/\/$/, '')),
              value: cp,
              key: cp,
              disabled: isInvalidMoveParent(cp, movingRel),
              isLeaf: false,
            }))
            setFolderMoveTreeData((origin) => updateFolderTreeChildren(origin, k, children))
            resolve()
          })
          .catch((e) => {
            message.error(formatAuthApiError(e))
            reject(e)
          })
      }),
    [message]
  )

  const openMoveFolder = (fullKey: string, relFolderPrefix: string) => {
    const rel = ensureRelFolderPrefix(relFolderPrefix)
    folderMoveSourceRelRef.current = rel
    folderMoveTreeLoadedKeysRef.current = new Set()
    setFolderMoveFromKey(fullKey)
    setFolderMoveOldRelPrefix(rel)
    setFolderMoveTreeData([])
    const defParent = normalizeRelDir(relParentOfFolderPrefix(rel))
    let safe: string | undefined
    if (defParent === '') {
      safe = isInvalidMoveParent('', rel) ? undefined : ''
    } else {
      safe = isInvalidMoveParent(defParent, rel) ? undefined : defParent
    }
    folderMoveForm.setFieldsValue({ targetParentPrefix: safe })
    setFolderMoveTreeExpandedKeys(expandKeysForParentRel(defParent))
    setFolderMoveOpen(true)
    void initFolderMoveTree(defParent)
  }

  const resetFolderMoveTreeUi = () => {
    folderMoveTreeLoadedKeysRef.current = new Set()
    setFolderMoveTreeData([])
    setFolderMoveTreeExpandedKeys([])
  }

  const submitMoveFolder = async () => {
    if (!folderMoveFromKey || !folderMoveOldRelPrefix) return
    const v = await folderMoveForm.validateFields()
    const parent = normalizeRelDir(v.targetParentPrefix ?? '')
    try {
      await cosMoveFolder({
        fromKey: folderMoveFromKey,
        targetParentPrefix: parent || undefined,
      })
      const folderName = basename(folderMoveOldRelPrefix.replace(/\/$/, ''))
      const newRelPrefix = `${parent}${folderName}/`
      setCurrentPrefix((prev) =>
        prev.startsWith(folderMoveOldRelPrefix)
          ? newRelPrefix + prev.slice(folderMoveOldRelPrefix.length)
          : prev
      )
      message.success('已移动文件夹')
      setFolderMoveOpen(false)
      setFolderMoveFromKey(null)
      setFolderMoveOldRelPrefix(null)
      resetFolderMoveTreeUi()
      folderMoveForm.resetFields()
      void load()
    } catch (e) {
      message.error(formatAuthApiError(e))
    }
  }

  const breadcrumbItems = useMemo(() => {
    const link = (label: string, prefix: string) => (
      <Typography.Link
        href="#"
        onClick={(e) => {
          e.preventDefault()
          setCurrentPrefix(prefix)
        }}
      >
        {label}
      </Typography.Link>
    )
    const items: { title: React.ReactNode }[] = [{ title: link('根目录', '') }]
    if (!currentPrefix) return items
    const parts = currentPrefix.replace(/\/$/, '').split('/').filter(Boolean)
    let acc = ''
    for (const p of parts) {
      acc = `${acc}${p}/`
      const prefixVal = acc
      items.push({
        title: link(p, prefixVal),
      })
    }
    return items
  }, [currentPrefix])

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: 12,
  }

  const uploadDropZoneStyle: React.CSSProperties = {
    border: `2px dashed ${uploadDropActive ? 'rgba(0, 122, 255, 0.55)' : 'rgba(0, 0, 0, 0.12)'}`,
    borderRadius: 12,
    padding: 22,
    textAlign: 'center',
    marginBottom: 16,
    background: uploadDropActive ? 'rgba(0, 122, 255, 0.06)' : 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    transition: 'border-color 0.18s ease, background 0.18s ease',
    cursor: uploadDropZoneBusy ? 'not-allowed' : 'pointer',
    outline: 'none',
  }

  const titleWithOptionalBack = (text: string) => (
    <Space align="center" size={4}>
      {embedded && onBackToLocalFiles ? (
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            onBackToLocalFiles()
          }}
          aria-label="返回文件列表"
        />
      ) : null}
      <span>{text}</span>
    </Space>
  )

  if (cosDisabled) {
    return (
      <Card
        title={titleWithOptionalBack('云图库（腾讯云 COS）')}
        style={{ ...cardStyle, ...(embedded ? { height: '100%', display: 'flex', flexDirection: 'column' as const } : {}) }}
      >
        <Alert
          type="info"
          showIcon
          message="未配置对象存储"
          description={
            <>
              请在数据库 <Typography.Text code>app_parameters</Typography.Text> 中配置腾讯云 COS（
              <Typography.Text code>cos_secret_id</Typography.Text>、<Typography.Text code>cos_secret_key</Typography.Text>、
              <Typography.Text code>cos_region</Typography.Text>、<Typography.Text code>cos_bucket</Typography.Text>
              等），或由管理员调用 <Typography.Text code>POST /admin/parameters/cos</Typography.Text>
              后重启认证 API；并在腾讯云控制台为存储桶配置 CORS（允许 PUT/GET 等），详见{' '}
              <Typography.Text code>DEVELOPMENT.md</Typography.Text> 中「腾讯云 COS」说明。
            </>
          }
        />
      </Card>
    )
  }

  const mainCardStyle: React.CSSProperties = embedded
    ? { ...cardStyle, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const }
    : cardStyle

  return (
    <Space
      direction="vertical"
      size="middle"
      style={{ width: '100%', ...(embedded ? { height: '100%', minHeight: 0 } : {}) }}
    >
      <Card
        title={titleWithOptionalBack('云图库（腾讯云 COS）')}
        style={mainCardStyle}
        styles={
          embedded
            ? { body: { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const } }
            : undefined
        }
        onDragOver={handleMainCardDragOver}
        onDrop={handleMainCardDrop}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          图片上传至当前账号专属路径；预览与直传使用短时预签名 URL。请在桶策略与 CORS 中允许本应用来源。可将图片拖到本卡片区域快速打开上传窗口。
        </Typography.Paragraph>
        <Space wrap style={{ marginBottom: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
            multiple
            style={{ display: 'none' }}
            onChange={onUploadFileInputChange}
          />
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={openUploadModal} disabled={isUploading}>
            上传图片
          </Button>
          <Button icon={<FolderAddOutlined />} onClick={() => setMkdirOpen(true)}>
            新建文件夹
          </Button>
          <Button onClick={() => void load()} loading={loading}>
            刷新
          </Button>
          {onOpenShareView && (
            <Button icon={<LinkOutlined />} onClick={() => setShareOpenInputVisible(true)}>
              打开分享
            </Button>
          )}
          {activeSelectionShare && (
            <>
              <Switch
                checked={showPickedOnly}
                onChange={setShowPickedOnly}
                checkedChildren="仅选中"
                unCheckedChildren="全部"
              />
              <Badge dot={hasUnseenSelection}>
                <Button onClick={() => openSelectionDrawer()}>
                  选片反馈 ({activeSelectionShare.submissionCount})
                </Button>
              </Badge>
              {activeSelectionShare.selectionEnabled && (
                <Button
                  type={recommendedEditing ? 'primary' : 'default'}
                  icon={<StarOutlined />}
                  onClick={() => setRecommendedEditing((v) => !v)}
                >
                  编辑推荐
                </Button>
              )}
            </>
          )}
        </Space>
        <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 12 }} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <Spin />
            </div>
          ) : folderRows.length === 0 && imageRows.length === 0 ? (
            <Empty description="当前目录为空" />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
                gap: 12,
              }}
            >
              {folderRows.map((row) => {
                const folderMenu: MenuProps['items'] = [
                  {
                    key: 'open',
                    label: '打开',
                    onClick: () => setCurrentPrefix(row.prefix),
                  },
                  {
                    key: 'move',
                    label: '移动',
                    disabled: !scopePrefix,
                    icon: <SwapOutlined />,
                    onClick: () => openMoveFolder(`${scopePrefix}${row.prefix}`, row.prefix),
                  },
                  {
                    key: 'rename',
                    label: '重命名',
                    disabled: !scopePrefix,
                    icon: <FormOutlined />,
                    onClick: () => openRenameFolder(`${scopePrefix}${row.prefix}`, row.prefix, row.label),
                  },
                  {
                    key: 'share',
                    label: '创建分享',
                    icon: <LinkOutlined />,
                    onClick: () => openShareFolder(`${scopePrefix}${row.prefix}`, row.label),
                  },
                  {
                    key: 'delete',
                    label: '删除',
                    danger: true,
                    icon: <DeleteOutlined />,
                    disabled: !scopePrefix,
                    onClick: () => onDeleteFolder(`${scopePrefix}${row.prefix}`, row.prefix, row.label),
                  },
                ]
                return (
                  <div key={row.key} style={COS_GRID_ITEM_STYLE}>
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
                      style={{ ...COS_GRID_THUMB_SHELL_STYLE, cursor: 'pointer' }}
                      aria-label={`打开文件夹 ${row.label}`}
                    >
                      <FolderOutlined style={{ fontSize: 36, color: 'rgba(0, 122, 255, 0.85)' }} />
                    </div>
                    <Typography.Text ellipsis title={row.label} style={{ display: 'block', fontSize: 12 }}>
                      {row.label}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      文件夹
                    </Typography.Text>
                    <Dropdown menu={{ items: folderMenu }} trigger={['click']} placement="bottomRight">
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        style={COS_GRID_ITEM_MORE_BTN_STYLE}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`文件夹 ${row.label} 更多操作`}
                      />
                    </Dropdown>
                  </div>
                )
              })}
              {imageRows.map((row) => {
                const imgMenu: MenuProps['items'] = [
                  {
                    key: 'preview',
                    label: '预览',
                    onClick: () => void openPreview(row.cosKey, row.name),
                  },
                  {
                    key: 'move',
                    label: '移动',
                    icon: <SwapOutlined />,
                    onClick: () => openMove(row.cosKey),
                  },
                  {
                    key: 'share',
                    label: '创建分享',
                    icon: <LinkOutlined />,
                    onClick: () => openShareFile(row.cosKey, row.name),
                  },
                  ...(activeSelectionShare?.selectionEnabled
                    ? [
                        {
                          key: 'recommend',
                          label: activeSelectionShare.recommendedKeys?.includes(row.cosKey)
                            ? '取消摄影师推荐'
                            : '标为摄影师推荐',
                          icon: <StarOutlined />,
                          onClick: () => void toggleRecommendedKey(row.cosKey),
                        },
                      ]
                    : []),
                  {
                    key: 'delete',
                    label: '删除',
                    danger: true,
                    icon: <DeleteOutlined />,
                    onClick: () => onDelete(row.cosKey),
                  },
                ]
                return (
                  <div key={row.key} style={COS_GRID_ITEM_STYLE}>
                    {row.pickCount > 0 && (
                      <Tag color="blue" style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, margin: 0 }}>
                        {row.pickCount} 次选中
                      </Tag>
                    )}
                    {activeSelectionShare?.recommendedKeys?.includes(row.cosKey) && (
                      <StarFilled
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          color: '#ff9f0a',
                          fontSize: 14,
                          zIndex: 2,
                        }}
                      />
                    )}
                    {recommendedEditing && activeSelectionShare?.selectionEnabled && (
                      <Button
                        type="text"
                        size="small"
                        icon={
                          activeSelectionShare.recommendedKeys?.includes(row.cosKey) ? (
                            <StarFilled style={{ color: '#ff9f0a' }} />
                          ) : (
                            <StarOutlined />
                          )
                        }
                        style={{ position: 'absolute', bottom: 28, right: 4, zIndex: 2 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          void toggleRecommendedKey(row.cosKey)
                        }}
                        aria-label="切换推荐"
                      />
                    )}
                    <CosBrowseThumb
                      cosKey={row.cosKey}
                      title={row.name}
                      onOpenPreview={() => void openPreview(row.cosKey, row.name)}
                    />
                    <Typography.Text ellipsis title={row.name} style={{ display: 'block', fontSize: 12 }}>
                      {row.name}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {formatFileSize(row.size)}
                    </Typography.Text>
                    <Dropdown menu={{ items: imgMenu }} trigger={['click']} placement="bottomRight">
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        style={COS_GRID_ITEM_MORE_BTN_STYLE}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${row.name} 更多操作`}
                      />
                    </Dropdown>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      <Modal
        title="上传图片"
        open={uploadModalOpen}
        width={600}
        maskClosable={!isUploading && !uploadScanning}
        closable={!isUploading && !uploadScanning}
        onCancel={() => {
          if (isUploading) {
            message.info('请等待上传结束后再关闭')
            return
          }
          if (uploadScanning) {
            message.info('正在读取文件，请稍候再关闭')
            return
          }
          closeUploadModal()
        }}
        footer={
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, width: '100%' }}>
            <Space align="center" style={{ marginRight: 'auto' }} wrap>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                选择后自动上传
              </Typography.Text>
              <Switch checked={autoUploadAfterSelect} onChange={setAutoUploadAfterSelect} disabled={isUploading} />
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                按 AI 分类分子目录
              </Typography.Text>
              <Switch
                checked={sortByCategoryOnUpload}
                onChange={setSortByCategoryOnUpload}
                disabled={isUploading}
              />
            </Space>
            <Space wrap style={{ marginLeft: 'auto' }}>
              {errorCount > 0 && !isUploading && !uploadScanning ? (
                <Button onClick={() => void retryAllFailed()}>重试全部失败</Button>
              ) : null}
              {pendingCount > 0 && !isUploading && !uploadScanning ? (
                <Button onClick={clearPendingUploads}>清空待上传</Button>
              ) : null}
              <Button
                disabled={isUploading || uploadScanning}
                onClick={() => {
                  if (isUploading) {
                    message.info('请等待上传结束后再关闭')
                    return
                  }
                  if (uploadScanning) {
                    message.info('正在读取文件，请稍候再关闭')
                    return
                  }
                  closeUploadModal()
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                disabled={pendingCount === 0 || isUploading || uploadScanning}
                onClick={() => void startUploads()}
              >
                {primaryUploadButtonLabel}
              </Button>
            </Space>
          </div>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
          图片将上传至当前目录（<Typography.Text code>{currentPrefix || '根目录'}</Typography.Text>
          ）。点击下方区域可多选图片；若要选择整个文件夹，请把文件夹拖入该区域（将扁平收集其中的图片）。上传时最多同时进行 3 个文件传输入 COS，完成后再继续下一批。
        </Typography.Paragraph>
        <div
          role="button"
          tabIndex={uploadDropZoneBusy ? -1 : 0}
          aria-disabled={uploadDropZoneBusy}
          onClick={onUploadDropZoneClick}
          onKeyDown={onUploadDropZoneKeyDown}
          onDragOver={onUploadDropZoneDragOver}
          onDragLeave={onUploadDropZoneDragLeave}
          onDrop={onUploadDropZoneDrop}
          style={uploadDropZoneStyle}
        >
          {uploadScanning ? (
            <Space direction="vertical" size="small" style={{ width: '100%', alignItems: 'center' }}>
              <Spin size="small" />
              <Typography.Text>正在读取文件…</Typography.Text>
            </Space>
          ) : isUploading ? (
            <Typography.Text>上传中，请稍候…</Typography.Text>
          ) : (
            <Typography.Text>点击选择图片，或将文件夹拖入此区域</Typography.Text>
          )}
        </div>
        <Space align="center" style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }} wrap>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            共 {uploadTasks.length} 项{pendingCount > 0 ? `，待上传 ${pendingCount} 个` : ''}
            {uploadScanning ? ' · 正在读取…' : ''}
            {isUploading ? ' · 上传中…' : ''}
          </Typography.Text>
        </Space>
        <List
          size="small"
          bordered
          dataSource={uploadTasks}
          locale={{ emptyText: '暂无文件，请点击上方区域选择图片，或将文件夹拖入' }}
          style={{ maxHeight: 320, overflow: 'auto' }}
          renderItem={(t) => {
            const tag =
              t.status === 'success' ? (
                <Tag color="success">完成</Tag>
              ) : t.status === 'error' ? (
                <Tag color="error">失败</Tag>
              ) : t.status === 'uploading' ? (
                <Tag color="processing">上传中</Tag>
              ) : (
                <Tag>待上传</Tag>
              )
            const progStatus =
              t.status === 'error' ? 'exception' : t.status === 'success' ? 'success' : 'active'
            const speedLine =
              t.status === 'uploading' ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatCosImageUploadSpeed(t.speedBps)}
                  {t.percent === 0 ? ' · 正在连接服务器…' : ''}
                </Typography.Text>
              ) : null
            return (
              <List.Item
                key={t.id}
                actions={(() => {
                  const actions: React.ReactNode[] = []
                  if (t.status === 'pending' && !isUploading && !uploadScanning) {
                    actions.push(
                      <Button type="link" size="small" danger key="rm" onClick={() => removeUploadTask(t.id)}>
                        移除
                      </Button>
                    )
                  }
                  if (t.status === 'error' && !isUploading && !uploadScanning) {
                    actions.push(
                      <Button type="link" size="small" key="retry" onClick={() => retryUploadTask(t.id)}>
                        重试
                      </Button>
                    )
                  }
                  return actions
                })()}
              >
                <div style={{ width: '100%' }}>
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                      <Space align="start" size={10} style={{ minWidth: 0, flex: 1 }}>
                        {t.previewUrl ? (
                          <img
                            src={t.previewUrl}
                            alt=""
                            style={{
                              width: 48,
                              height: 48,
                              objectFit: 'cover',
                              borderRadius: 8,
                              flexShrink: 0,
                              background: 'rgba(0,0,0,0.06)',
                            }}
                          />
                        ) : null}
                        <Typography.Text ellipsis style={{ maxWidth: 300 }} title={t.displayPath}>
                          {t.displayPath}
                        </Typography.Text>
                      </Space>
                      {tag}
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {formatFileSize(t.file.size)}
                    </Typography.Text>
                    {t.status !== 'pending' ? (
                      <>
                        <Progress percent={t.percent} status={progStatus} strokeWidth={8} />
                        {speedLine}
                      </>
                    ) : null}
                    {t.errorMessage ? (
                      <Typography.Paragraph type="danger" style={{ marginBottom: 0, fontSize: 12 }}>
                        {t.errorMessage}
                      </Typography.Paragraph>
                    ) : null}
                  </Space>
                </div>
              </List.Item>
            )
          }}
        />
      </Modal>

      <Modal title="预览" open={Boolean(preview)} footer={null} width={600} onCancel={() => setPreview(null)}>
        {preview ? (
          <img alt={preview.title} src={preview.url} draggable={false} style={COS_PREVIEW_MODAL_IMG_STYLE} />
        ) : null}
      </Modal>

      <Modal
        title="新建文件夹"
        open={mkdirOpen}
        onOk={() => void submitMkdir()}
        onCancel={() => setMkdirOpen(false)}
        destroyOnClose
      >
        <Form form={mkdirForm} layout="vertical">
          <Form.Item name="name" label="文件夹名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="不含斜杠" maxLength={128} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="重命名文件夹"
        open={renameFolderOpen}
        onOk={() => void submitRenameFolder()}
        onCancel={() => {
          setRenameFolderOpen(false)
          setRenameFolderFromKey(null)
          setRenameFolderOldRelPrefix(null)
          renameFolderForm.resetFields()
        }}
        destroyOnClose
      >
        <Form form={renameFolderForm} layout="vertical">
          <Form.Item name="newName" label="新名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="不含斜杠" maxLength={128} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="移动文件夹"
        width={560}
        open={folderMoveOpen}
        onOk={() => void submitMoveFolder()}
        onCancel={() => {
          setFolderMoveOpen(false)
          setFolderMoveFromKey(null)
          setFolderMoveOldRelPrefix(null)
          resetFolderMoveTreeUi()
          folderMoveForm.resetFields()
        }}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
          在下方树中选择目标父目录；将整夹（含子目录与图片）移动到该目录下，文件夹名称不变。灰色项为不可选（与当前文件夹冲突）。
        </Typography.Paragraph>
        <Form form={folderMoveForm} layout="vertical">
          <Form.Item
            label="目标父目录"
            name="targetParentPrefix"
            rules={[
              {
                validator: async (_, value) => {
                  if (value === undefined || value === null) {
                    throw new Error('请选择目标父目录')
                  }
                },
              },
            ]}
          >
            <TreeSelect
              placeholder="展开并选择目录，或搜索名称"
              allowClear
              showSearch
              treeNodeFilterProp="title"
              style={{ width: '100%' }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto', minWidth: 440 }}
              treeData={folderMoveTreeData}
              loadData={(node) => loadFolderMoveTreeChildren(node as FolderMoveTreeNode)}
              treeExpandedKeys={folderMoveTreeExpandedKeys as (string | number)[]}
              onTreeExpand={(keys) => setFolderMoveTreeExpandedKeys(keys as React.Key[])}
              treeLine
              filterTreeNode={(input, node) =>
                String(node.title ?? '')
                  .toLowerCase()
                  .includes(input.trim().toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={shareResultToken ? '分享链接已创建' : '创建分享链接'}
        open={shareOpen}
        onOk={() => (shareResultToken ? setShareOpen(false) : void submitShare())}
        okText={shareResultToken ? '完成' : '创建'}
        confirmLoading={shareSubmitting}
        onCancel={() => {
          setShareOpen(false)
          setShareTarget(null)
          setShareResultToken(null)
          shareForm.resetFields()
        }}
        destroyOnClose
      >
        {shareResultToken ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              复制链接后在应用内打开，或粘贴到地址栏 hash（#share/令牌）。
              {shareTarget?.resourceType === 'folder' && shareForm.getFieldValue('selectionEnabled') && (
                <> 已开启选片反馈，访客提交后可在本文件夹查看反馈。</>
              )}
            </Typography.Paragraph>
            <Input readOnly value={buildShareDeepLink(shareResultToken)} />
            <Space wrap>
              <Button
                onClick={() => {
                  void copyShareLink(shareResultToken).then(() => message.success('已复制分享链接'))
                }}
              >
                复制链接
              </Button>
              {onOpenShareView && (
                <Button
                  type="primary"
                  onClick={() => {
                    onOpenShareView(shareResultToken)
                    setShareOpen(false)
                  }}
                >
                  应用内预览
                </Button>
              )}
            </Space>
          </Space>
        ) : (
          <Form
            form={shareForm}
            layout="vertical"
            initialValues={{
              permission: 'read',
              expiresInHours: 168,
              selectionEnabled: false,
              selectionRound: 1,
              assetVariant: 'original',
              hideQualityFailed: false,
            }}
          >
            <Typography.Paragraph style={{ marginBottom: 12 }}>
              分享「{shareTarget?.name ?? ''}」
            </Typography.Paragraph>
            {shareTarget?.resourceType === 'folder' && (
              <>
                <Form.Item name="selectionEnabled" label="选片反馈" valuePropName="checked">
                  <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                </Form.Item>
                <Form.Item name="selectionRound" label="选片轮次">
                  <Select
                    options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `第 ${n} 轮` }))}
                  />
                </Form.Item>
                <Form.Item name="assetVariant" label="资源集">
                  <Select
                    options={[
                      { value: 'original', label: '原图' },
                      { value: 'edited', label: '精修版（_edited 后缀）' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="hideQualityFailed" label="隐藏质检未通过" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </>
            )}
            <Form.Item name="permission" label="权限">
              <Select
                options={[
                  { value: 'read', label: '仅预览' },
                  { value: 'download', label: '预览与下载' },
                ]}
              />
            </Form.Item>
            <Form.Item name="expiresInHours" label="有效期">
              <Select
                options={[
                  { value: 24, label: '1 天' },
                  { value: 168, label: '7 天（默认）' },
                  { value: 720, label: '30 天' },
                  { value: 0, label: '永不过期' },
                ]}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {onOpenShareView && (
        <ShareOpenModal
          open={shareOpenInputVisible}
          onClose={() => setShareOpenInputVisible(false)}
          onOpenShare={onOpenShareView}
        />
      )}

      <CosSelectionDrawer
        open={selectionDrawerOpen}
        onClose={() => setSelectionDrawerOpen(false)}
        share={activeSelectionShare}
        folderFullPrefix={activeSelectionShare?.cosPrefix ?? `${scopePrefix}${currentPrefix || ''}`}
        mkdirParentRelative={
          activeSelectionShare?.cosPrefix?.startsWith(scopePrefix)
            ? activeSelectionShare.cosPrefix.slice(scopePrefix.length)
            : currentPrefix || undefined
        }
        onRefreshFolder={() => void load()}
      />

      <Modal
        title="移动 / 重命名"
        open={moveOpen}
        onOk={() => void submitMove()}
        onCancel={() => setMoveOpen(false)}
        destroyOnClose
      >
        <Form form={moveForm} layout="vertical">
          <Form.Item label="目标目录（相对根）" name="parentPrefix">
            <Input placeholder="留空表示根目录；子目录示例 photos/" />
          </Form.Item>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: -8 }}>
            目录请使用以 <Typography.Text code>/</Typography.Text> 结尾的相对路径（如 <Typography.Text code>photos/</Typography.Text>
            ）；留空表示保存在根目录。
          </Typography.Paragraph>
          <Form.Item name="newFileName" label="文件名" rules={[{ required: true, message: '请输入文件名' }]}>
            <Input placeholder="含扩展名，如 photo.png" maxLength={240} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default CosImageLibraryTab
