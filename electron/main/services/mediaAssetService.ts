/**
 * RAW 嵌入预览提取、Apple Live Photo 配对、媒体资源探测
 */

import { createHash } from 'crypto'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import sharp from 'sharp'
import {
  getExtensionFromPath,
  getFileBaseName,
  isLiveStillPath,
  isLiveVideoPath,
  isRawImagePath
} from '../utils/mediaExtensions'

export type MediaAssetKind = 'standard' | 'raw' | 'live'

export interface MediaAssetInfo {
  kind: MediaAssetKind
  stillPath: string
  liveVideoPath?: string
  rawUsesEmbeddedPreview?: boolean
  contentIdentifier?: string
}

const PREVIEW_BINARY_TAGS = ['PreviewImage', 'JpgFromRaw', 'OtherImage', 'ThumbnailImage'] as const

const probeCache = new Map<string, MediaAssetInfo>()
const rawPreviewPathCache = new Map<string, string>()

export function getMediaPreviewCacheDir(): string {
  const dir = join(app.getPath('temp'), 'fileDeal-preview-cache')
  mkdirSync(dir, { recursive: true })
  return dir
}

function getPreviewCacheDir(): string {
  return getMediaPreviewCacheDir()
}

function cacheKeyForFile(filePath: string): string {
  try {
    const st = statSync(filePath)
    return createHash('sha1').update(`${filePath}|${st.size}|${st.mtimeMs}`).digest('hex')
  } catch {
    return createHash('sha1').update(filePath).digest('hex')
  }
}

function cachedRawPreviewPath(filePath: string): string {
  return join(getPreviewCacheDir(), `${cacheKeyForFile(filePath)}.jpg`)
}

async function getExiftool() {
  const { exiftool } = await import('exiftool-vendored')
  return exiftool
}

async function readContentIdentifier(filePath: string): Promise<string | undefined> {
  try {
    const exiftool = await getExiftool()
    const tags = (await exiftool.read(filePath)) as Record<string, unknown>
    const id = tags.ContentIdentifier ?? tags.MediaGroupUUID
    if (id == null || id === '') return undefined
    return String(id).trim()
  } catch {
    return undefined
  }
}

function findSiblingMov(stillPath: string): string | undefined {
  const dir = dirname(stillPath)
  const base = getFileBaseName(stillPath.split(/[/\\]/).pop() || stillPath)
  const candidates = [
    join(dir, `${base}.mov`),
    join(dir, `${base}.MOV`),
    join(dir, `${base}.MOV`.toLowerCase())
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return undefined
}

async function extractRawPreviewBuffer(filePath: string): Promise<Buffer | null> {
  const exiftool = await getExiftool()

  try {
    await exiftool.extractJpgFromRaw(filePath, cachedRawPreviewPath(filePath) + '.tmp.jpg')
    const tmp = cachedRawPreviewPath(filePath) + '.tmp.jpg'
    if (existsSync(tmp)) {
      const buf = await import('fs').then(fs => fs.promises.readFile(tmp))
      await import('fs').then(fs => fs.promises.unlink(tmp).catch(() => {}))
      if (buf.length > 0) return buf
    }
  } catch {
    // continue
  }

  try {
    const tmpPreview = cachedRawPreviewPath(filePath) + '.tmp-preview.jpg'
    await exiftool.extractPreview(filePath, tmpPreview)
    if (existsSync(tmpPreview)) {
      const buf = await import('fs').then(fs => fs.promises.readFile(tmpPreview))
      await import('fs').then(fs => fs.promises.unlink(tmpPreview).catch(() => {}))
      if (buf.length > 0) return buf
    }
  } catch {
    // continue
  }

  for (const tag of PREVIEW_BINARY_TAGS) {
    try {
      const buf = await exiftool.extractBinaryTagToBuffer(
        tag as 'PreviewImage',
        filePath
      )
      if (buf && buf.length > 0) return buf
    } catch {
      // try next tag
    }
  }

  try {
    const buf = await sharp(filePath).rotate().jpeg({ quality: 90 }).toBuffer()
    if (buf.length > 0) return buf
  } catch {
    // ignore
  }

  return null
}

async function ensureRawPreviewFile(filePath: string): Promise<string | null> {
  const cached = rawPreviewPathCache.get(filePath)
  if (cached && existsSync(cached)) return cached

  const outPath = cachedRawPreviewPath(filePath)
  if (existsSync(outPath)) {
    rawPreviewPathCache.set(filePath, outPath)
    return outPath
  }

  const buffer = await extractRawPreviewBuffer(filePath)
  if (!buffer) return null

  writeFileSync(outPath, buffer)
  rawPreviewPathCache.set(filePath, outPath)
  return outPath
}

export async function probeMediaAsset(filePath: string): Promise<MediaAssetInfo> {
  const cached = probeCache.get(filePath)
  if (cached) return cached

  const normalized = filePath.trim()
  let info: MediaAssetInfo

  if (isRawImagePath(normalized)) {
    const previewPath = await ensureRawPreviewFile(normalized)
    info = {
      kind: 'raw',
      stillPath: previewPath || normalized,
      rawUsesEmbeddedPreview: Boolean(previewPath)
    }
  } else if (isLiveStillPath(normalized)) {
    const movPath = findSiblingMov(normalized)
    let liveVideoPath: string | undefined
    let contentIdentifier: string | undefined

    if (movPath) {
      const stillId = await readContentIdentifier(normalized)
      const movId = await readContentIdentifier(movPath)
      contentIdentifier = stillId || movId
      if (!stillId || !movId || stillId === movId) {
        liveVideoPath = movPath
      }
    }

    info = {
      kind: liveVideoPath ? 'live' : 'standard',
      stillPath: normalized,
      liveVideoPath,
      contentIdentifier
    }
  } else {
    info = {
      kind: 'standard',
      stillPath: normalized
    }
  }

  probeCache.set(filePath, info)
  return info
}

/** 用于缩略图/原图加载的实际静帧路径 */
export async function resolveStillPathForDisplay(filePath: string): Promise<{
  displayPath: string
  kind: MediaAssetKind
  rawUsesEmbeddedPreview?: boolean
}> {
  const probe = await probeMediaAsset(filePath)
  if (probe.kind === 'raw' && probe.rawUsesEmbeddedPreview && probe.stillPath !== filePath) {
    return {
      displayPath: probe.stillPath,
      kind: 'raw',
      rawUsesEmbeddedPreview: true
    }
  }
  return {
    displayPath: filePath,
    kind: probe.kind,
    rawUsesEmbeddedPreview: probe.rawUsesEmbeddedPreview
  }
}

export function isLikelyLiveCompanionMov(movPath: string, stillPathInSameDir?: string): boolean {
  if (!isLiveVideoPath(movPath)) return false
  if (!stillPathInSameDir) return false
  const movBase = getFileBaseName(movPath.split(/[/\\]/).pop() || movPath).toLowerCase()
  const stillBase = getFileBaseName(stillPathInSameDir.split(/[/\\]/).pop() || stillPathInSameDir).toLowerCase()
  return movBase === stillBase && isLiveStillPath(stillPathInSameDir)
}

export function clearMediaAssetProbeCache(): void {
  probeCache.clear()
}

export async function shutdownMediaAssetCache(): Promise<void> {
  probeCache.clear()
  rawPreviewPathCache.clear()
  try {
    const { exiftool } = await import('exiftool-vendored')
    await exiftool.end()
  } catch {
    // ignore
  }
}
