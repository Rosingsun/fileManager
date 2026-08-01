import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { message } from 'antd'
import { TbX, TbChevronLeft, TbPlayerSkipForward } from '../icons'
import type { SimilarityGroup } from '../../types'
import { formatFileSize } from '../../utils'
import { basename } from './similarityShared'
import {
  initComparePair,
  applyPickLeft,
  applyPickRight,
  compareInnerProgress,
  type ComparePairState,
} from './similarityCompare'
import { useSyncedImageViewport } from './useSyncedImageViewport'
import SyncedImagePane from './SyncedImagePane'
import { SimilarityButton } from './SimilarityButton'

export interface SimilarityCompareViewProps {
  open: boolean
  groups: SimilarityGroup[]
  groupIndex: number
  groupSelections: Map<string, Set<string>>
  onGroupSelectionsChange: React.Dispatch<React.SetStateAction<Map<string, Set<string>>>>
  onGroupIndexChange: (index: number) => void
  onClose: () => void
  loadImage: (filePath: string) => Promise<string | null>
}

const SimilarityCompareView: React.FC<SimilarityCompareViewProps> = ({
  open,
  groups,
  groupIndex,
  groupSelections,
  onGroupSelectionsChange,
  onGroupIndexChange,
  onClose,
  loadImage,
}) => {
  const [pairState, setPairState] = useState<ComparePairState | null>(null)
  const [imageCache, setImageCache] = useState<Map<string, string>>(new Map())
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set())
  const [errorPaths, setErrorPaths] = useState<Set<string>>(new Set())
  const { viewport, resetViewport, handleWheel, panBy } = useSyncedImageViewport()
  /** 切换组时递增，用于作废上一组未完成的加载（不用 per-request gen，避免左右并行互相取消） */
  const loadSessionRef = useRef(0)
  const inflightRef = useRef<Set<string>>(new Set())
  const imageCacheRef = useRef(imageCache)
  imageCacheRef.current = imageCache

  const currentGroup = groups[groupIndex] ?? null

  const setKeepForGroup = useCallback(
    (groupId: string, keepPath: string) => {
      onGroupSelectionsChange((prev) => {
        const next = new Map(prev)
        next.set(groupId, new Set([keepPath]))
        return next
      })
    },
    [onGroupSelectionsChange]
  )

  useEffect(() => {
    if (!open || !currentGroup || currentGroup.images.length < 2) return
    loadSessionRef.current += 1
    inflightRef.current.clear()
    setErrorPaths(new Set())
    setLoadingPaths(new Set())
    const keepSet = groupSelections.get(currentGroup.id) ?? new Set()
    setPairState(initComparePair(currentGroup.images, keepSet))
    resetViewport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, groupIndex, currentGroup?.id])

  const loadPath = useCallback(
    async (filePath: string, options?: { force?: boolean }) => {
      if (!options?.force && imageCacheRef.current.has(filePath)) return
      if (!options?.force && inflightRef.current.has(filePath)) return

      const sessionAtStart = loadSessionRef.current
      inflightRef.current.add(filePath)

      setLoadingPaths((prev) => new Set(prev).add(filePath))
      setErrorPaths((prev) => {
        const n = new Set(prev)
        n.delete(filePath)
        return n
      })

      try {
        const data = await loadImage(filePath)
        if (sessionAtStart !== loadSessionRef.current) return
        if (data) {
          setImageCache((prev) => new Map(prev).set(filePath, data))
        } else {
          setErrorPaths((prev) => new Set(prev).add(filePath))
        }
      } catch {
        if (sessionAtStart === loadSessionRef.current) {
          setErrorPaths((prev) => new Set(prev).add(filePath))
        }
      } finally {
        inflightRef.current.delete(filePath)
        setLoadingPaths((prev) => {
          const n = new Set(prev)
          n.delete(filePath)
          return n
        })
      }
    },
    [loadImage]
  )

  useEffect(() => {
    if (!open || !pairState) return
    void loadPath(pairState.leftPath)
    if (pairState.rightPath) void loadPath(pairState.rightPath)
  }, [open, pairState?.leftPath, pairState?.rightPath, loadPath])

  const goToGroup = useCallback(
    (index: number) => {
      if (index < 0 || index >= groups.length) return false
      const group = groups[index]
      if (group.images.length < 2) {
        if (index + 1 < groups.length) return goToGroup(index + 1)
        return false
      }
      onGroupIndexChange(index)
      return true
    },
    [groups, onGroupIndexChange]
  )

  const goNextGroup = useCallback(() => {
    resetViewport()
    const nextIndex = groupIndex + 1
    if (nextIndex >= groups.length) {
      message.success('已全部审阅')
      onClose()
      return
    }
    if (!goToGroup(nextIndex)) {
      message.success('已全部审阅')
      onClose()
    }
  }, [groupIndex, groups.length, goToGroup, onClose, resetViewport])

  const goPrevGroup = useCallback(() => {
    if (groupIndex <= 0) return
    resetViewport()
    for (let i = groupIndex - 1; i >= 0; i--) {
      if (goToGroup(i)) return
    }
  }, [groupIndex, goToGroup, resetViewport])

  const handlePick = useCallback(
    (side: 'left' | 'right') => {
      if (!currentGroup || !pairState) return
      const result =
        side === 'left'
          ? applyPickLeft(pairState, currentGroup.images)
          : applyPickRight(pairState, currentGroup.images)
      setKeepForGroup(currentGroup.id, result.keepPath)
      resetViewport()
      if (result.groupComplete) {
        goNextGroup()
      } else {
        setPairState(result.state)
      }
    },
    [currentGroup, pairState, setKeepForGroup, resetViewport, goNextGroup]
  )

  const handleSkipAreaClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.sim-compare-pane')) return
      goNextGroup()
    },
    [goNextGroup]
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        goPrevGroup()
      }
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        goNextGroup()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, goPrevGroup, goNextGroup])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || !currentGroup || !pairState) return null

  const { leftPath, rightPath } = pairState
  const leftImg = currentGroup.images.find((i) => i.filePath === leftPath)
  const rightImg = rightPath
    ? currentGroup.images.find((i) => i.filePath === rightPath)
    : null
  const inner = compareInnerProgress(currentGroup.images, pairState.resolvedPaths)
  const recommended = currentGroup.recommendedKeep

  const content = (
    <div
      className="sim-compare"
      role="dialog"
      aria-modal="true"
      aria-label="相似照片对比"
      onClick={handleSkipAreaClick}
    >
      <header className="sim-compare__head" onClick={(e) => e.stopPropagation()}>
        <div className="sim-compare__info">
          <span className="sim-compare__title">
            相似组 {groupIndex + 1}/{groups.length}
          </span>
          <span className="sim-compare__sub">
            组内 {inner.current}/{inner.total} · 平均 {currentGroup.similarity}%
          </span>
        </div>
        <div className="sim-compare__actions">
          <SimilarityButton
            variant="secondary"
            size="sm"
            icon={<TbChevronLeft size={16} />}
            disabled={groupIndex <= 0}
            onClick={goPrevGroup}
          >
            上一组
          </SimilarityButton>
          <SimilarityButton
            variant="secondary"
            size="sm"
            icon={<TbPlayerSkipForward size={16} />}
            onClick={goNextGroup}
          >
            下一组
          </SimilarityButton>
          <SimilarityButton
            variant="ghost"
            size="sm"
            icon={<TbX size={16} />}
            onClick={onClose}
          >
            关闭
          </SimilarityButton>
        </div>
      </header>

      <p className="sim-compare__hint">
        点击要保留的一侧（保留在原位，另一侧加载下一张）· 滚轮缩放 · 拖拽平移 · 点击空白处跳过本组
      </p>

      <div className="sim-compare__body">
        <SyncedImagePane
          side="left"
          imageSrc={imageCache.get(leftPath) ?? null}
          loading={loadingPaths.has(leftPath)}
          error={errorPaths.has(leftPath)}
          onRetry={() => void loadPath(leftPath, { force: true })}
          viewport={viewport}
          onWheel={handleWheel}
          onPanBy={panBy}
          onPick={() => handlePick('left')}
          title={basename(leftPath)}
          meta={leftImg ? formatFileSize(leftImg.size) : undefined}
          badge={leftPath === recommended ? 'rec' : null}
        />
        <div className="sim-compare__divider" aria-hidden />
        <SyncedImagePane
          side="right"
          imageSrc={rightPath ? (imageCache.get(rightPath) ?? null) : null}
          loading={rightPath ? loadingPaths.has(rightPath) : false}
          error={rightPath ? errorPaths.has(rightPath) : false}
          onRetry={rightPath ? () => void loadPath(rightPath, { force: true }) : undefined}
          viewport={viewport}
          onWheel={handleWheel}
          onPanBy={panBy}
          onPick={() => handlePick('right')}
          title={rightPath ? basename(rightPath) : ''}
          meta={rightImg ? formatFileSize(rightImg.size) : undefined}
          badge={rightPath === recommended ? 'rec' : null}
        />
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

export default SimilarityCompareView
