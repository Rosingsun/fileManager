import { app, session } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { readdir, rm, stat } from 'fs/promises'
import { clearMediaAssetProbeCache, getMediaPreviewCacheDir } from './mediaAssetService'
import { clearImagenetSessionCache } from './imageClassificationService'
import { clearClipModelCache } from '../utils/clipClassifier'
import { clearCognivisionMobilenetCache } from './cognivisionTfClassifier'

export type MainCacheScope = 'previewDisk' | 'chromiumDisk' | 'modelSessions'

export interface CacheSizeStats {
  itemCount: number
  totalBytes: number
}

export interface MainCacheOverview {
  previewDisk: CacheSizeStats
  chromiumDisk: CacheSizeStats
  modelSessions: { itemCount: number }
}

async function getDirectorySize(dir: string): Promise<CacheSizeStats> {
  if (!existsSync(dir)) {
    return { itemCount: 0, totalBytes: 0 }
  }

  let itemCount = 0
  let totalBytes = 0

  const walk = async (current: string): Promise<void> => {
    let entries: import('fs').Dirent[]
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      try {
        const st = await stat(fullPath)
        itemCount++
        totalBytes += st.size
      } catch {
        /* ignore */
      }
    }
  }

  await walk(dir)
  return { itemCount, totalBytes }
}

export function clearModelSessions(): void {
  clearImagenetSessionCache()
  clearClipModelCache()
  clearCognivisionMobilenetCache()
}

export async function getMainCacheOverview(): Promise<MainCacheOverview> {
  const previewDir = getMediaPreviewCacheDir()
  const chromiumDir = join(app.getPath('userData'), 'cache')

  const [previewDisk, chromiumDisk] = await Promise.all([
    getDirectorySize(previewDir),
    getDirectorySize(chromiumDir),
  ])

  return {
    previewDisk,
    chromiumDisk,
    modelSessions: { itemCount: 0 },
  }
}

export async function clearMainCache(scopes: MainCacheScope[]): Promise<void> {
  const unique = new Set(scopes)

  if (unique.has('previewDisk')) {
    const previewDir = getMediaPreviewCacheDir()
    clearMediaAssetProbeCache()
    if (existsSync(previewDir)) {
      await rm(previewDir, { recursive: true, force: true })
    }
  }

  if (unique.has('chromiumDisk')) {
    await session.defaultSession.clearCache()
  }

  if (unique.has('modelSessions')) {
    clearModelSessions()
  }
}
