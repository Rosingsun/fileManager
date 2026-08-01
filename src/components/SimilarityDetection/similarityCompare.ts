import type { ImageHash } from '../../types'

export interface ComparePairState {
  leftPath: string
  rightPath: string | null
  resolvedPaths: Set<string>
}

export function pickInitialLeftPath(images: ImageHash[], keepSet: Set<string>): string {
  for (const img of images) {
    if (keepSet.has(img.filePath)) return img.filePath
  }
  return images[0].filePath
}

/** 取下一张待对比图：不在当前左右栏且未淘汰 */
export function getNextChallenger(
  images: ImageHash[],
  occupiedPaths: Set<string>,
  resolvedPaths: Set<string>
): string | null {
  for (const img of images) {
    const path = img.filePath
    if (!occupiedPaths.has(path) && !resolvedPaths.has(path)) return path
  }
  return null
}

export function initComparePair(images: ImageHash[], keepSet: Set<string>): ComparePairState | null {
  if (images.length < 2) return null
  const leftPath = pickInitialLeftPath(images, keepSet)
  const rightPath = getNextChallenger(images, new Set([leftPath]), new Set())
  if (!rightPath) return null
  return { leftPath, rightPath, resolvedPaths: new Set() }
}

export function compareInnerProgress(images: ImageHash[], resolvedPaths: Set<string>): {
  current: number
  total: number
} {
  const total = Math.max(images.length - 1, 1)
  const current = Math.min(resolvedPaths.size + 1, total)
  return { current, total }
}

export interface PickResult {
  state: ComparePairState
  keepPath: string
  groupComplete: boolean
}

/** 点左侧：左侧保留原位，右侧加载下一张 */
export function applyPickLeft(state: ComparePairState, images: ImageHash[]): PickResult {
  const { leftPath, rightPath, resolvedPaths } = state
  if (!rightPath) {
    return { state, keepPath: leftPath, groupComplete: true }
  }
  const nextResolved = new Set(resolvedPaths)
  nextResolved.add(rightPath)
  const nextRight = getNextChallenger(images, new Set([leftPath]), nextResolved)
  return {
    state: { leftPath, rightPath: nextRight, resolvedPaths: nextResolved },
    keepPath: leftPath,
    groupComplete: nextRight === null,
  }
}

/** 点右侧：右侧保留原位，左侧加载下一张 */
export function applyPickRight(state: ComparePairState, images: ImageHash[]): PickResult {
  const { leftPath, rightPath, resolvedPaths } = state
  if (!rightPath) {
    return { state, keepPath: leftPath, groupComplete: true }
  }
  const nextResolved = new Set(resolvedPaths)
  nextResolved.add(leftPath)
  const nextLeft = getNextChallenger(images, new Set([rightPath]), nextResolved)
  return {
    state: { leftPath: nextLeft ?? leftPath, rightPath, resolvedPaths: nextResolved },
    keepPath: rightPath,
    groupComplete: nextLeft === null,
  }
}
