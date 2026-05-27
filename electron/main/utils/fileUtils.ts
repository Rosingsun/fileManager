import { join } from 'path'
import { existsSync } from 'fs'
import { getExtensionFromPath } from './mediaExtensions'

export { IMAGE_EXTENSIONS } from './mediaExtensions'

export function getMimeType(filePath: string): string {
  const ext = getExtensionFromPath(filePath)
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'cr2': 'image/x-canon-cr2',
    'cr3': 'image/x-canon-cr3',
    'nef': 'image/x-nikon-nef',
    'nrw': 'image/x-nikon-nrw',
    'arw': 'image/x-sony-arw',
    'dng': 'image/x-adobe-dng',
    'raf': 'image/x-fuji-raf',
    'orf': 'image/x-olympus-orf',
    'rw2': 'image/x-panasonic-rw2',
    'pef': 'image/x-pentax-pef',
    'raw': 'image/x-panasonic-raw',
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'mkv': 'video/x-matroska',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    '': 'application/octet-stream'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

export function getPreloadPath(): string {
  const possiblePaths = [
    join(__dirname, '../preload/preload.mjs'),
    join(__dirname, '../preload/preload.js'),
    join(process.cwd(), 'dist-electron/preload/preload.mjs'),
    join(process.cwd(), 'dist-electron/preload/preload.js'),
    join(process.cwd(), 'out/preload/preload.mjs'),
    join(process.cwd(), 'out/preload/preload.js'),
    join(__dirname, '../../dist-electron/preload/preload.mjs'),
    join(__dirname, '../../out/preload/preload.mjs')
  ]
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log('[Main] 使用预加载脚本路径:', path)
      return path
    }
  }
  
  const errorMsg = `预加载脚本未找到！已尝试的路径：\n${possiblePaths.join('\n')}`
  console.error('[Main]', errorMsg)
  throw new Error(errorMsg)
}

