import { createWriteStream, existsSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { ClassificationModelId } from './classificationModels'
import {
  MODEL_FILE_NAMES,
  ensureModelsDir,
  getClassificationModelPath,
  getModelInfo,
  getModelsDir
} from './classificationModels'
import { resolveProjectRoot } from './projectRoot'

const DEFAULT_HF_MIRROR = 'https://hf-mirror.com'
const GITHUB_PROXY_PREFIXES = ['https://ghproxy.net/', 'https://mirror.ghproxy.com/']

export function getHfMirrorBase(): string {
  const raw = process.env.FILEDEAL_HF_ENDPOINT?.trim()
  if (raw) return raw.replace(/\/$/, '')
  return DEFAULT_HF_MIRROR
}

/** 镜像 / 代理 URL 优先，减少国内直连 Hugging Face 超时 */
export function expandDownloadUrls(urls: readonly string[]): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  const mirror = getHfMirrorBase()

  const add = (u: string) => {
    const trimmed = u.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    ordered.push(trimmed)
  }

  for (const url of urls) {
    if (url.includes('huggingface.co/')) {
      add(url.replace(/^https?:\/\/huggingface\.co\//, `${mirror}/`))
      add(url)
      continue
    }
    if (/^https?:\/\/github\.com\/.+\/raw\//.test(url)) {
      for (const prefix of GITHUB_PROXY_PREFIXES) {
        add(`${prefix}${url}`)
      }
      add(url)
      continue
    }
    add(url)
  }

  return ordered
}

export interface ModelDownloadProgress {
  progress: number
  bytesDownloaded: number
  totalBytes: number
}

export interface ModelDownloadResult {
  success: boolean
  error?: string
  cancelled?: boolean
  downloadUrls?: string[]
}

async function streamUrlToFile(
  url: string,
  tempPath: string,
  emitProgress: (downloadedBytes: number, totalBytes: number) => void,
  isCancelled: () => boolean
): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 600_000)

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'fileDeal/1.0 (Electron; model-download)',
        Accept: '*/*'
      }
    })

    if (!response.ok) {
      console.warn('[Main] 下载 HTTP', response.status, url)
      return false
    }
    if (!response.body) {
      console.warn('[Main] 下载无响应体:', url)
      return false
    }

    const totalBytes = Number(response.headers.get('content-length') || 0)
    const fileStream = createWriteStream(tempPath)
    const bodyStream = Readable.fromWeb(
      response.body as import('stream/web').ReadableStream<Uint8Array>
    )

    let downloadedBytes = 0
    bodyStream.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length
      emitProgress(downloadedBytes, totalBytes)
      if (isCancelled()) {
        controller.abort()
      }
    })

    await pipeline(bodyStream, fileStream)
    return true
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (isCancelled() || msg.includes('aborted')) {
      console.log('[Main] 下载已取消')
    } else {
      console.warn('[Main] 下载失败:', msg, url)
    }
    return false
  } finally {
    clearTimeout(timeout)
    if (existsSync(tempPath)) {
      try {
        const size = statSync(tempPath).size
        if (size < 1024) unlinkSync(tempPath)
      } catch {
        /* ignore */
      }
    }
  }
}

export async function downloadModelFile(
  modelId: ClassificationModelId,
  options: {
    onProgress?: (p: ModelDownloadProgress) => void
    isCancelled?: () => boolean
    sendIpcProgress?: (p: ModelDownloadProgress) => void
    onSaved?: (modelId: ClassificationModelId) => void
  } = {}
): Promise<ModelDownloadResult> {
  const modelInfo = getModelInfo(modelId)
  if (!modelInfo) {
    return { success: false, error: '未知的模型 ID', downloadUrls: [] }
  }
  if (modelId === 'cognivision') {
    return { success: true }
  }

  const modelUrls = expandDownloadUrls(modelInfo.downloadUrls)
  if (modelUrls.length === 0) {
    return { success: false, error: '该模型无在线下载地址', downloadUrls: [] }
  }

  const root = resolveProjectRoot()
  const modelFileName = MODEL_FILE_NAMES[modelId] || `${modelId}.onnx`
  const modelPath = getClassificationModelPath(modelId, root)
  const tempPath = join(getModelsDir(root), `${modelFileName}.tmp`)

  console.log('[Main] 模型下载目录:', getModelsDir(root), '目标:', modelPath)

  if (existsSync(modelPath)) {
    return { success: true, downloadUrls: modelUrls }
  }

  ensureModelsDir(root)
  if (existsSync(tempPath)) {
    unlinkSync(tempPath)
  }

  const emitProgress = (downloadedBytes: number, totalBytes: number): void => {
    const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0
    const payload = { progress, bytesDownloaded: downloadedBytes, totalBytes }
    options.onProgress?.(payload)
    options.sendIpcProgress?.(payload)
  }

  const isCancelled = options.isCancelled ?? (() => false)

  for (let urlIndex = 0; urlIndex < modelUrls.length; urlIndex++) {
    const url = modelUrls[urlIndex]
    if (isCancelled()) {
      return { success: false, cancelled: true, downloadUrls: modelUrls }
    }

    for (let retry = 0; retry < 2; retry++) {
      if (existsSync(tempPath)) unlinkSync(tempPath)

      console.log(
        `[Main] 下载模型 ${modelId} (${urlIndex + 1}/${modelUrls.length}${retry ? ` 重试${retry}` : ''}):`,
        url
      )

      const ok = await streamUrlToFile(url, tempPath, emitProgress, isCancelled)
      if (isCancelled()) {
        if (existsSync(tempPath)) unlinkSync(tempPath)
        return { success: false, cancelled: true, downloadUrls: modelUrls }
      }
      if (!ok || !existsSync(tempPath)) continue

      try {
        const fileSize = statSync(tempPath).size
        if (fileSize < 1024) {
          unlinkSync(tempPath)
          continue
        }
        if (existsSync(modelPath)) unlinkSync(modelPath)
        const { renameSync } = await import('fs')
        renameSync(tempPath, modelPath)
        options.onSaved?.(modelId)
        console.log('[Main] 模型下载完成:', modelPath, `(${(fileSize / 1024 / 1024).toFixed(2)} MB)`)
        emitProgress(fileSize, fileSize)
        return { success: true, downloadUrls: modelUrls }
      } catch (error: unknown) {
        if (existsSync(tempPath)) unlinkSync(tempPath)
        const msg = error instanceof Error ? error.message : String(error)
        console.warn('[Main] 保存模型失败:', msg)
      }
    }
  }

  console.error('[Main] 所有下载 URL 均失败', modelId)
  return {
    success: false,
    error:
      '无法下载模型文件。请检查网络（国内建议可访问 hf-mirror.com），或在弹窗中手动导入 ONNX 到 models 目录。',
    downloadUrls: modelUrls
  }
}
