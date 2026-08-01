import React, { useState, useRef, useCallback } from 'react'
import { message } from 'antd'
import { PictureOutlined } from '@ant-design/icons'
import { TbArrowsLeftRight, TbCheck, TbFolderSymlink, TbRefresh, TbTrash } from '../icons'
import SimilarityCompareView from './SimilarityCompareView'
import SimilarityMoveDialog from './SimilarityMoveDialog'
import type { FileConflictAction, SimilarityScanResult, SimilarityScanConfig, SimilarityGroup } from '../../types'
import { formatFileSize, formatDateTime, logSignedInUserAction, imageLoader, waitForElectronApiReady, getElectronApiIssueMessage } from '../../utils'
import ImagePreview, { type ImageSource } from '../ImagePreview/ImagePreview'
import { AppEmptyState } from '../UnifiedUI'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Badge } from '../ui/badge'
import { Checkbox } from '../ui/checkbox'
import { FeatureActionDialogFooter } from '../FeatureAction'
import { SimilarityButton, SimilarityButtonGroup } from './SimilarityButton'
import SimilarityGroupStrip from './SimilarityGroupStrip'
import { basename, getAlgorithmLabel, getDefaultDuplicateFolder, joinPath, removePathsFromSimilarityResult } from './similarityShared'

interface SimilarityResultsViewProps {
  result: SimilarityScanResult
  config: SimilarityScanConfig
  onReset: () => void
  onResultChange: (next: SimilarityScanResult) => void
}

const SimilarityResultsView: React.FC<SimilarityResultsViewProps> = ({
  result,
  config,
  onReset,
  onResultChange,
}) => {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [groupSelections, setGroupSelections] = useState<Map<string, Set<string>>>(new Map())
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewImages, setPreviewImages] = useState<ImageSource[]>([])
  const [previewCurrentIndex, setPreviewCurrentIndex] = useState(0)
  const [imageThumbnails, setImageThumbnails] = useState<Map<string, string>>(new Map())
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareGroupIndex, setCompareGroupIndex] = useState(0)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [moveDestDir, setMoveDestDir] = useState('')
  const [moveConflict, setMoveConflict] = useState<FileConflictAction>('rename')
  const [pendingMove, setPendingMove] = useState<string[]>([])
  const [moving, setMoving] = useState(false)
  const loadingRef = useRef<Set<string>>(new Set())

  const loadAllThumbnails = useCallback(async () => {
    const allImages: string[] = []
    result.groups.forEach((group) => {
      group.images.forEach((img) => allImages.push(img.filePath))
    })
    try {
      await imageLoader.preloadBatch(allImages, 'thumbnail', 4)
      const thumbnails = new Map<string, string>()
      await Promise.allSettled(
        allImages.map(async (filePath) => {
          try {
            const loaded = await imageLoader.loadThumbnail(filePath, 320, 85, {
              useCache: true,
              timeout: 10000,
              retryCount: 1,
            })
            if (loaded.data) thumbnails.set(filePath, loaded.data)
          } catch {
            /* skip */
          }
        })
      )
      setImageThumbnails(thumbnails)
    } catch {
      for (const filePath of allImages) {
        if (loadingRef.current.has(filePath)) continue
        loadingRef.current.add(filePath)
        setLoadingThumbnails((prev) => new Set(prev).add(filePath))
        try {
          const loaded = await imageLoader.loadThumbnail(filePath, 320, 85)
          if (loaded.data) setImageThumbnails((prev) => new Map(prev).set(filePath, loaded.data))
        } finally {
          loadingRef.current.delete(filePath)
          setLoadingThumbnails((prev) => {
            const next = new Set(prev)
            next.delete(filePath)
            return next
          })
        }
      }
    }
  }, [result.groups])

  React.useEffect(() => {
    const newSelections = new Map<string, Set<string>>()
    result.groups.forEach((group) => {
      const keepSet = new Set<string>()
      if (group.recommendedKeep) keepSet.add(group.recommendedKeep)
      else if (group.images.length > 0) keepSet.add(group.images[0].filePath)
      newSelections.set(group.id, keepSet)
    })
    setGroupSelections(newSelections)
    setSelectedGroups(new Set(result.groups.map((g) => g.id)))
    setImageThumbnails(new Map())
    loadingRef.current.clear()
    setLoadingThumbnails(new Set())
    loadAllThumbnails()
  }, [result, loadAllThumbnails])

  const spaceToSave = () => {
    let total = 0
    result.groups.forEach((group) => {
      if (!selectedGroups.has(group.id)) return
      const keepSet = groupSelections.get(group.id) || new Set()
      group.images.forEach((img) => {
        if (!keepSet.has(img.filePath)) total += img.size
      })
    })
    return total
  }

  const handleGroupToggle = (groupId: string) => {
    const next = new Set(selectedGroups)
    if (next.has(groupId)) next.delete(groupId)
    else next.add(groupId)
    setSelectedGroups(next)
  }

  const handleSelectAllGroups = () => {
    if (selectedGroups.size === result.groups.length) setSelectedGroups(new Set())
    else setSelectedGroups(new Set(result.groups.map((g) => g.id)))
  }

  const handleImageToggle = (groupId: string, imagePath: string) => {
    const newSelections = new Map(groupSelections)
    const groupSelection = new Set(newSelections.get(groupId) || [])
    if (groupSelection.has(imagePath)) {
      if (groupSelection.size > 1) groupSelection.delete(imagePath)
      else {
        message.warning('每组至少需要保留一张照片')
        return
      }
    } else groupSelection.add(imagePath)
    newSelections.set(groupId, groupSelection)
    setGroupSelections(newSelections)
  }

  const handleMarkAllBest = () => {
    const newSelections = new Map<string, Set<string>>()
    result.groups.forEach((group) => {
      const keepSet = new Set<string>()
      if (group.recommendedKeep) keepSet.add(group.recommendedKeep)
      else if (group.images.length > 0) keepSet.add(group.images[0].filePath)
      newSelections.set(group.id, keepSet)
    })
    setGroupSelections(newSelections)
    message.success('已标记所有推荐保留项')
    logSignedInUserAction('similarity_mark_keep', `已标记 ${result.groups.length} 组推荐保留项`)
  }

  const collectFilesToKeep = () => {
    const paths: string[] = []
    result.groups
      .filter((g) => selectedGroups.has(g.id))
      .forEach((group) => {
        const keepSet = groupSelections.get(group.id) || new Set()
        keepSet.forEach((p) => paths.push(p))
      })
    return paths
  }

  const handleMoveDuplicates = () => {
    const filesToMove = collectFilesToDelete()
    if (filesToMove.length === 0) {
      message.warning('没有可移动的冗余照片')
      return
    }
    setMoveDestDir(getDefaultDuplicateFolder(config.scanPath))
    setPendingMove(filesToMove)
    setMoveConflict('rename')
    setMoveDialogOpen(true)
  }

  const handlePickMoveFolder = async () => {
    if (moving) return
    const ready = await waitForElectronApiReady({ requiredMethod: 'openDirectory' })
    if (!ready || !window.electronAPI?.openDirectory) {
      message.error(getElectronApiIssueMessage('openDirectory'))
      return
    }
    const dir = await window.electronAPI.openDirectory()
    if (dir) setMoveDestDir(dir)
  }

  const handleConfirmMove = async () => {
    if (!window.electronAPI?.batchRelocate || !moveDestDir || pendingMove.length === 0) return
    setMoving(true)
    try {
      const moves = pendingMove.map((from) => ({
        from,
        to: joinPath(moveDestDir, basename(from)),
      }))
      const results = await window.electronAPI.batchRelocate(moves, moveConflict)
      const okPaths = new Set(results.filter((r) => r.success).map((r) => r.filePath))
      const ok = okPaths.size
      const fail = results.length - ok
      if (fail === 0) message.success(`已将 ${ok} 张冗余照片移入重复文件夹`)
      else message.warning(`整理完成：成功 ${ok}，失败 ${fail}`)
      logSignedInUserAction(
        'similarity_move_duplicates',
        `相似图冗余移入重复文件夹（成功 ${ok}，失败 ${fail}）`,
        moveDestDir
      )
      if (ok > 0) {
        onResultChange(removePathsFromSimilarityResult(result, okPaths))
      }
      setMoveDialogOpen(false)
      setPendingMove([])
      setMoveDestDir('')
    } finally {
      setMoving(false)
    }
  }

  const collectFilesToDelete = () => {
    const filesToDelete: string[] = []
    result.groups
      .filter((g) => selectedGroups.has(g.id))
      .forEach((group) => {
        const keepSet = groupSelections.get(group.id) || new Set()
        group.images.forEach((img) => {
          if (!keepSet.has(img.filePath)) filesToDelete.push(img.filePath)
        })
      })
    return filesToDelete
  }

  const handleDeleteSelected = () => {
    const filesToDelete = collectFilesToDelete()
    if (filesToDelete.length === 0) {
      message.warning('没有可删除的照片')
      return
    }
    setPendingDelete(filesToDelete)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!window.electronAPI) {
      message.error('Electron API 不可用')
      return
    }
    setDeleting(true)
    let successCount = 0
    let failCount = 0
    try {
      for (const filePath of pendingDelete) {
        try {
          if (await window.electronAPI.deleteFile(filePath)) successCount++
          else failCount++
        } catch {
          failCount++
        }
      }
      if (failCount === 0) message.success(`已删除 ${successCount} 张`)
      else message.warning(`成功 ${successCount}，失败 ${failCount}`)
      logSignedInUserAction(
        'similarity_batch_delete',
        `相似图删除（成功 ${successCount}，失败 ${failCount}）`
      )
      setDeleteDialogOpen(false)
      setPendingDelete([])
      onReset()
    } finally {
      setDeleting(false)
    }
  }

  const loadImageBase64 = useCallback(async (filePath: string) => {
    try {
      const loaded = await imageLoader.loadSmart(filePath, {
        useCache: true,
        timeout: 15000,
        retryCount: 1,
        fallbackSize: 400,
        fallbackQuality: 80,
      })
      return loaded.data ?? null
    } catch {
      return null
    }
  }, [])

  const handlePreviewImage = useCallback(
    async (imagePath: string, groupId: string) => {
      const targetGroup = result.groups.find((g) => g.id === groupId)
      if (!targetGroup) return
      const imageSources: ImageSource[] = []
      let currentIndex = 0
      for (const img of targetGroup.images) {
        const base64 = await loadImageBase64(img.filePath)
        if (base64) {
          imageSources.push({
            src: base64,
            title: basename(img.filePath),
            description: `${formatFileSize(img.size)} · ${formatDateTime(img.modifiedTime)}`,
          })
          if (img.filePath === imagePath) currentIndex = imageSources.length - 1
        }
      }
      if (!imageSources.length) {
        message.error('无法加载预览')
        return
      }
      setPreviewImages(imageSources)
      setPreviewCurrentIndex(currentIndex)
      setPreviewVisible(true)
    },
    [result.groups, loadImageBase64]
  )

  const openCompareAt = useCallback((index: number) => {
    setCompareGroupIndex(index)
    setCompareOpen(true)
  }, [])

  const renderGroup = (group: SimilarityGroup, index: number) => (
    <article
      key={group.id}
      className={`sim-group ${selectedGroups.has(group.id) ? 'is-selected' : ''}`}
    >
      <header className="sim-group__head">
        <div className="sim-group__left">
          <Checkbox
            checked={selectedGroups.has(group.id)}
            onCheckedChange={() => handleGroupToggle(group.id)}
          />
          <div>
            <div className="sim-group__title">相似组 {index + 1}</div>
            <div className="sim-group__sub">
              {group.images.length} 张相似 · 平均 {group.similarity}%
            </div>
          </div>
        </div>
        <div className="sim-group__head-right">
          {group.images.length >= 2 ? (
            <SimilarityButton
              variant="secondary"
              size="sm"
              icon={<TbArrowsLeftRight size={15} />}
              onClick={() => openCompareAt(index)}
            >
              对比
            </SimilarityButton>
          ) : null}
          <span className="sim-group__pct">{group.similarity}%</span>
        </div>
      </header>
      <SimilarityGroupStrip
        group={group}
        keepSet={groupSelections.get(group.id) || new Set()}
        thumbnails={imageThumbnails}
        loadingPaths={loadingThumbnails}
        onToggleKeep={(path) => handleImageToggle(group.id, path)}
        onPreview={(path) => handlePreviewImage(path, group.id)}
        onCompare={() => openCompareAt(index)}
      />
    </article>
  )

  const saved = spaceToSave()

  return (
    <div className="sim-results">
      <div className="sim-results-hero">
        <div className="sim-results-hero__path">
          <strong>扫描目录</strong>
          <code>{config.scanPath}</code>
        </div>
        <div className="sim-results-hero__chips">
          <Badge variant="outline" className="sim-chip">
            阈值 {config.similarityThreshold}%
          </Badge>
          <Badge variant="outline" className="sim-chip">
            {getAlgorithmLabel(config.algorithm)}
          </Badge>
        </div>
      </div>

      <div className="sim-metrics">
        <div className="sim-metric" style={{ ['--metric-accent' as string]: 'var(--app-primary)' }}>
          <span className="sim-metric__label">扫描照片</span>
          <span className="sim-metric__value">{result.totalImages}</span>
        </div>
        <div className="sim-metric" style={{ ['--metric-accent' as string]: 'var(--app-success)' }}>
          <span className="sim-metric__label">相似组</span>
          <span className="sim-metric__value">{result.totalGroups}</span>
        </div>
        <div className="sim-metric" style={{ ['--metric-accent' as string]: 'var(--app-warning)' }}>
          <span className="sim-metric__label">可释放</span>
          <span className="sim-metric__value">{formatFileSize(saved)}</span>
        </div>
        <div className="sim-metric" style={{ ['--metric-accent' as string]: 'var(--app-file-audio)' }}>
          <span className="sim-metric__label">耗时</span>
          <span className="sim-metric__value">{(result.scanTime / 1000).toFixed(1)}s</span>
        </div>
      </div>

      <div className="sim-legend">
        <span className="sim-legend__item">
          <span className="sim-legend__dot sim-legend__dot--keep" /> 保留
        </span>
        <span className="sim-legend__item">
          <span className="sim-legend__dot sim-legend__dot--del" /> 冗余
        </span>
        <span className="sim-legend__item">
          <span className="sim-legend__dot sim-legend__dot--rec" /> 推荐
        </span>
      </div>

      <div className="sim-groups-head">
        <h2 className="sim-groups-head__title">相似分组</h2>
        <span className="sim-groups-head__sub">共 {result.groups.length} 组</span>
      </div>

      {result.groups.length === 0 ? (
        <AppEmptyState
          panel
          icon={<PictureOutlined />}
          title="未发现相似照片"
          description="可尝试放宽阈值或更换目录后重新扫描。"
          actions={
            <SimilarityButton
              variant="secondary"
              size="md"
              icon={<TbRefresh size={16} />}
              onClick={onReset}
            >
              重新扫描
            </SimilarityButton>
          }
        />
      ) : (
        <div className="sim-groups">{result.groups.map(renderGroup)}</div>
      )}

      <footer className="sim-dock">
        <div className="sim-dock__summary">
          已选 <strong>{selectedGroups.size}</strong> / {result.groups.length} 组
          <span>预计释放 {formatFileSize(saved)}</span>
        </div>
        <div className="sim-dock__actions">
          <SimilarityButtonGroup aria-label="批量选择">
            <SimilarityButton variant="secondary" size="sm" onClick={handleSelectAllGroups}>
              {selectedGroups.size === result.groups.length ? '取消全选' : '全选'}
            </SimilarityButton>
            <SimilarityButton
              variant="emphasis"
              size="sm"
              icon={<TbCheck size={15} />}
              onClick={handleMarkAllBest}
            >
              推荐保留
            </SimilarityButton>
          </SimilarityButtonGroup>
          <SimilarityButton
            className="sim-dock__cta"
            variant="emphasis"
            size="md"
            icon={<TbFolderSymlink size={16} />}
            disabled={!selectedGroups.size || moving || deleting}
            onClick={handleMoveDuplicates}
          >
            移入重复文件夹
          </SimilarityButton>
          <SimilarityButton
            variant="danger"
            size="md"
            icon={<TbTrash size={16} />}
            disabled={!selectedGroups.size || deleting || moving}
            onClick={handleDeleteSelected}
          >
            永久删除
          </SimilarityButton>
          <SimilarityButton
            variant="ghost"
            size="md"
            icon={<TbRefresh size={16} />}
            onClick={onReset}
          >
            重新扫描
          </SimilarityButton>
        </div>
      </footer>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!deleting) {
            setDeleteDialogOpen(open)
            if (!open) setPendingDelete([])
          }
        }}
      >
        <AlertDialogContent className="sim-dialog-content">
          <AlertDialogHeader>
            <AlertDialogMedia className="sim-dialog-media">
              <TbTrash aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p className="sim-dialog-desc">
                将永久删除 <strong className="sim-dialog-count">{pendingDelete.length}</strong>{' '}
                张照片，此操作不可撤销。
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FeatureActionDialogFooter
            confirmLabel={deleting ? '删除中…' : '确定删除'}
            confirmVariant="danger"
            cancelDisabled={deleting}
            confirmDisabled={deleting}
            onCancel={() => {
              if (!deleting) {
                setDeleteDialogOpen(false)
                setPendingDelete([])
              }
            }}
            onConfirm={() => void handleConfirmDelete()}
          />
        </AlertDialogContent>
      </AlertDialog>

      <SimilarityMoveDialog
        open={moveDialogOpen}
        destDir={moveDestDir}
        fileCount={pendingMove.length}
        keepCount={collectFilesToKeep().length}
        conflict={moveConflict}
        moving={moving}
        onConflictChange={setMoveConflict}
        onPickFolder={() => void handlePickMoveFolder()}
        onCancel={() => {
          if (!moving) {
            setMoveDialogOpen(false)
            setPendingMove([])
            setMoveDestDir('')
          }
        }}
        onConfirm={() => void handleConfirmMove()}
      />

      <ImagePreview
        visible={previewVisible}
        images={previewImages}
        currentIndex={previewCurrentIndex}
        onClose={() => setPreviewVisible(false)}
        onIndexChange={setPreviewCurrentIndex}
        width={900}
        showToolbar
        showNavigation={previewImages.length > 1}
        enableKeyboard
      />

      <SimilarityCompareView
        open={compareOpen}
        groups={result.groups}
        groupIndex={compareGroupIndex}
        groupSelections={groupSelections}
        onGroupSelectionsChange={setGroupSelections}
        onGroupIndexChange={setCompareGroupIndex}
        onClose={() => setCompareOpen(false)}
        loadImage={loadImageBase64}
      />
    </div>
  )
}

export default SimilarityResultsView
