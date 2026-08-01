import type { FileInfo, FormatConversionOptions, ImageEditSettings } from '../types'
import { isPreviewableImage, normalizeExtension } from './mediaExtensions'

export type EditorExportOverwriteMode = 'new_file' | 'overwrite'

export function getParentDir(filePath: string): string {
  const i = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return i >= 0 ? filePath.slice(0, i) : filePath
}

export function normalizePathForCompare(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase()
}

export function defaultTargetFormatFromPath(filePath: string): string {
  const m = filePath.match(/\.([a-zA-Z0-9]+)$/)
  const ext = m ? normalizeExtension(m[1]) : 'jpeg'
  if (ext === 'jpg') return 'jpeg'
  if (ext === 'tif') return 'tiff'
  if (['jpeg', 'png', 'webp', 'bmp', 'tiff'].includes(ext)) return ext
  return 'jpeg'
}

export function buildEditorExportOptions(
  editSettings: ImageEditSettings,
  targetFormat: string,
  quality: number,
  overwriteMode: EditorExportOverwriteMode
): FormatConversionOptions {
  return {
    targetFormat,
    quality,
    editSettings,
    overwrite: overwriteMode === 'overwrite',
  }
}

export function filterSiblingImagePaths(entries: FileInfo[], currentFilePath: string): string[] {
  const current = normalizePathForCompare(currentFilePath)
  return entries
    .filter(e => !e.isDirectory)
    .filter(e => {
      const m = e.name.match(/\.([a-zA-Z0-9]+)$/)
      return m ? isPreviewableImage(m[1]) : false
    })
    .map(e => e.path)
    .filter(p => normalizePathForCompare(p) !== current)
}

export async function listSiblingImagesForExport(currentFilePath: string): Promise<string[]> {
  const api = window.electronAPI
  if (!api?.readDirectory) return []
  const dir = getParentDir(currentFilePath)
  const entries = await api.readDirectory(dir)
  return filterSiblingImagePaths(entries, currentFilePath)
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function basenameFromPath(filePath: string): string {
  const i = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return i >= 0 ? filePath.slice(i + 1) : filePath
}

/** 路径过长时保留首尾，便于弹窗展示 */
export function truncatePathForDisplay(filePath: string, maxLen = 52): string {
  if (filePath.length <= maxLen) return filePath
  const head = Math.ceil((maxLen - 3) * 0.45)
  const tail = maxLen - 3 - head
  return `${filePath.slice(0, head)}…${filePath.slice(-tail)}`
}
