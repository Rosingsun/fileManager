import { protocol, net } from 'electron'
import { extname, normalize } from 'path'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.ogg': 'audio/ogg',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.mkv': 'video/x-matroska',
  '.3gp': 'video/3gpp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4',
  '.wma': 'audio/x-ms-wma',
  '.ape': 'audio/ape',
  '.aiff': 'audio/aiff',
  '.pdf': 'application/pdf'
}

/** 从 media-local 请求 URL 解析本地绝对路径（兼容新旧 URL 格式） */
export function resolveMediaLocalFilePath(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl)
    if (url.protocol !== 'media-local:') return null

    const hostPart = url.hostname ? decodeURIComponent(url.hostname) : ''
    const pathPart = url.pathname && url.pathname !== '/' ? url.pathname : ''
    let raw: string

    if (pathPart) {
      raw = decodeURIComponent(pathPart)
      if (raw.startsWith('/')) raw = raw.slice(1)
      if (hostPart) raw = `${hostPart}/${raw}`
    } else if (hostPart) {
      raw = hostPart
    } else {
      raw = decodeURIComponent(requestUrl.replace(/^media-local:\/\//i, ''))
    }

    if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(raw)) {
      raw = raw.slice(1)
    }

    const filePath = normalize(raw)
    if (!existsSync(filePath)) return null
    return filePath
  } catch {
    return null
  }
}

function mimeForPath(filePath: string): string | undefined {
  return MIME_BY_EXT[extname(filePath).toLowerCase()]
}

export function registerMediaLocalProtocol(): void {
  protocol.handle('media-local', async (request) => {
    const filePath = resolveMediaLocalFilePath(request.url)
    if (!filePath) {
      return new Response('Not Found', { status: 404, statusText: 'Not Found' })
    }

    const fileUrl = pathToFileURL(filePath).toString()
    const response = await net.fetch(fileUrl)

    const mime = mimeForPath(filePath)
    if (!mime) return response

    const headers = new Headers(response.headers)
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', mime)
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  })
}
