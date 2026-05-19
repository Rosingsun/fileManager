import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
import type { MessageInstance } from 'antd/es/message/interface'
import { cosUploadImageViaApi, formatAuthApiError } from '../utils'

const IMG_RE = /\.(jpe?g|png|gif|webp)$/i
const COS_UPLOAD_CONCURRENCY = 3
const AUTO_UPLOAD_STORAGE_KEY = 'cosImageLibrary.autoUploadAfterSelect'

export type CosUploadTask = {
  id: string
  file: File
  displayPath: string
  previewUrl?: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  percent: number
  errorMessage?: string
  speedBps?: number
}

function readAutoUploadInitial(): boolean {
  try {
    const v = localStorage.getItem(AUTO_UPLOAD_STORAGE_KEY)
    if (v === null) return true
    return v === 'true'
  } catch {
    return true
  }
}

export function revokeTaskPreview(t: CosUploadTask): void {
  if (t.previewUrl) URL.revokeObjectURL(t.previewUrl)
}

function newUploadTaskId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export function isCosImageFileName(name: string): boolean {
  return IMG_RE.test(name.split('/').pop() || '')
}

function taskDedupeKey(f: File): string {
  const rel = f.webkitRelativePath && f.webkitRelativePath.length > 0 ? f.webkitRelativePath : f.name
  return `${rel}\0${f.size}\0${f.lastModified}`
}

export function formatCosImageUploadSpeed(bps: number | undefined): string {
  if (bps === undefined || !Number.isFinite(bps) || bps <= 0) return '—'
  if (bps < 1024) return `${bps.toFixed(0)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`
}

type WebKitEntry = {
  isFile: boolean
  isDirectory: boolean
  name: string
  file: (ok: (file: File) => void, err?: (e: DOMException) => void) => void
  createReader: () => {
    readEntries: (ok: (entries: WebKitEntry[]) => void, err?: (e: DOMException) => void) => void
  }
}

type WebKitDirReader = {
  readEntries: (ok: (entries: WebKitEntry[]) => void, err?: (e: DOMException) => void) => void
}

async function readAllDirEntries(reader: WebKitDirReader): Promise<WebKitEntry[]> {
  const acc: WebKitEntry[] = []
  for (;;) {
    const batch = await new Promise<WebKitEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (batch.length === 0) break
    acc.push(...batch)
  }
  return acc
}

async function collectFilesFromWebKitEntry(entry: WebKitEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file(resolve, reject)
    })
    return isCosImageFileName(file.name) ? [file] : []
  }
  if (entry.isDirectory) {
    const reader = entry.createReader()
    const children = await readAllDirEntries(reader)
    const nested = await Promise.all(children.map((ch) => collectFilesFromWebKitEntry(ch)))
    return nested.flat()
  }
  return []
}

export async function collectImageFilesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items)
  const hasWebKit = items.some(
    (it) => typeof (it as unknown as { webkitGetAsEntry?: () => WebKitEntry | null }).webkitGetAsEntry === 'function'
  )
  const fromFiles = Array.from(dt.files).filter((f) => isCosImageFileName(f.name))
  if (hasWebKit) {
    const out: File[] = []
    for (const it of items) {
      const wk = (it as unknown as { webkitGetAsEntry?: () => WebKitEntry | null }).webkitGetAsEntry?.()
      if (wk) {
        out.push(...(await collectFilesFromWebKitEntry(wk)))
      } else if (it.kind === 'file') {
        const f = it.getAsFile()
        if (f && isCosImageFileName(f.name)) out.push(f)
      }
    }
    if (out.length > 0) return out
  }
  return fromFiles
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  async function worker() {
    for (;;) {
      const i = nextIndex++
      if (i >= items.length) break
      results[i] = await fn(items[i])
    }
  }
  const n = Math.min(Math.max(1, concurrency), Math.max(1, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

export function useCosImageUpload(options: {
  message: MessageInstance
  currentPrefix: string
  onAfterBatchUpload: () => void
}) {
  const { message, currentPrefix, onAfterBatchUpload } = options

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const uploadModalOpenRef = useRef(false)
  const [uploadTasks, setUploadTasks] = useState<CosUploadTask[]>([])
  const [uploadDropActive, setUploadDropActive] = useState(false)
  const [uploadScanning, setUploadScanning] = useState(false)
  const [autoUploadAfterSelect, setAutoUploadAfterSelectState] = useState(readAutoUploadInitial)
  const uploadBatchLockRef = useRef(false)

  const uploadTasksRef = useRef<CosUploadTask[]>([])
  useEffect(() => {
    uploadTasksRef.current = uploadTasks
  }, [uploadTasks])

  useEffect(() => {
    uploadModalOpenRef.current = uploadModalOpen
  }, [uploadModalOpen])

  useEffect(() => {
    return () => {
      for (const t of uploadTasksRef.current) {
        revokeTaskPreview(t)
      }
    }
  }, [])

  const setAutoUploadAfterSelect = useCallback((v: boolean) => {
    setAutoUploadAfterSelectState(v)
    try {
      localStorage.setItem(AUTO_UPLOAD_STORAGE_KEY, v ? 'true' : 'false')
    } catch {
      /* ignore */
    }
  }, [])

  const updateUploadTask = useCallback((id: string, patch: Partial<CosUploadTask>) => {
    setUploadTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const isUploading = uploadTasks.some((t) => t.status === 'uploading')
  const pendingCount = uploadTasks.filter((t) => t.status === 'pending').length
  const errorCount = uploadTasks.filter((t) => t.status === 'error').length
  const uploadDropZoneBusy = isUploading || uploadScanning

  const startUploads = useCallback(
    async (pendingOverride?: CosUploadTask[]) => {
      if (uploadBatchLockRef.current) return
      const source = pendingOverride ?? uploadTasksRef.current
      const pending = source.filter((t) => t.status === 'pending')
      if (pending.length === 0) {
        message.warning('请先添加要上传的图片')
        return
      }
      uploadBatchLockRef.current = true

      const runOne = async (task: CosUploadTask): Promise<'success' | 'error'> => {
        const taskId = task.id
        let lastLoaded = 0
        let lastTs = performance.now()
        let smoothedBps = 0

        updateUploadTask(taskId, {
          status: 'uploading',
          percent: 0,
          errorMessage: undefined,
          speedBps: undefined,
        })
        try {
          await cosUploadImageViaApi(task.file, {
            parentPrefix: currentPrefix || undefined,
            onProgress: (loaded, total) => {
              const now = performance.now()
              const dtSec = (now - lastTs) / 1000
              if (dtSec >= 0.12 && loaded >= lastLoaded) {
                const dBytes = loaded - lastLoaded
                if (dBytes > 0 && dtSec > 0) {
                  const inst = dBytes / dtSec
                  smoothedBps = smoothedBps > 0 ? smoothedBps * 0.62 + inst * 0.38 : inst
                }
                lastLoaded = loaded
                lastTs = now
              }
              const p = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
              updateUploadTask(taskId, { percent: p, speedBps: smoothedBps > 0 ? smoothedBps : undefined })
            },
          })
          revokeTaskPreview(task)
          updateUploadTask(taskId, {
            status: 'success',
            percent: 100,
            speedBps: undefined,
            previewUrl: undefined,
          })
          return 'success'
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          let friendly = formatAuthApiError(err)
          if (err instanceof TypeError && /fetch|Failed to fetch|NetworkError|Network request failed/i.test(msg)) {
            friendly = '无法连接认证服务，请确认后端已启动且地址配置正确'
          }
          updateUploadTask(taskId, { status: 'error', percent: 0, errorMessage: friendly, speedBps: undefined })
          return 'error'
        }
      }

      try {
        const outcomes = await mapPool(pending, COS_UPLOAD_CONCURRENCY, runOne)
        const errCountResult = outcomes.filter((o) => o === 'error').length
        const n = pending.length
        if (errCountResult === 0) message.success(`已上传 ${n} 个文件`)
        else if (errCountResult === n) message.error('上传失败，请查看下方状态与说明')
        else message.warning(`已完成：成功 ${n - errCountResult}，失败 ${errCountResult}`)

        onAfterBatchUpload()
      } finally {
        uploadBatchLockRef.current = false
      }
    },
    [currentPrefix, message, onAfterBatchUpload, updateUploadTask]
  )

  const enqueueImageFiles = useCallback(
    (files: File[], opts?: { willAutoUpload?: boolean }): CosUploadTask[] => {
      const willAutoUpload = opts?.willAutoUpload ?? autoUploadAfterSelect
      const rawCount = files.length
      const images = files.filter((f) => isCosImageFileName(f.name))
      if (images.length === 0) {
        if (rawCount > 0) {
          message.warning(
            '所选文件中没有可上传的图片。支持 jpg、png、gif、webp；手机常见 HEIC 或 bmp/tiff 等请先导出为 jpg/png。'
          )
        } else {
          message.warning('没有可上传的图片（支持 jpg、png、gif、webp）')
        }
        return []
      }
      const prev = uploadTasksRef.current
      const seen = new Set(prev.map((t) => taskDedupeKey(t.file)))
      const newTasks: CosUploadTask[] = []
      for (const f of images) {
        const k = taskDedupeKey(f)
        if (seen.has(k)) continue
        seen.add(k)
        newTasks.push({
          id: newUploadTaskId(),
          file: f,
          displayPath: f.webkitRelativePath && f.webkitRelativePath.length > 0 ? f.webkitRelativePath : f.name,
          previewUrl: URL.createObjectURL(f),
          status: 'pending',
          percent: 0,
        })
      }

      if (newTasks.length > 0) {
        setUploadTasks((p) => {
          const inQueue = new Set(p.map((t) => taskDedupeKey(t.file)))
          const merged = [...p]
          for (const t of newTasks) {
            const dk = taskDedupeKey(t.file)
            if (inQueue.has(dk)) continue
            inQueue.add(dk)
            merged.push(t)
          }
          return merged
        })
      }

      if (newTasks.length === 0 && images.length > 0) {
        message.info('所选文件已在列表中')
      } else if (newTasks.length > 0) {
        if (!willAutoUpload) {
          message.info(`已添加 ${newTasks.length} 个文件，点击「开始上传」`)
        }
      }
      return newTasks
    },
    [message, autoUploadAfterSelect]
  )

  const removeUploadTask = useCallback((id: string) => {
    setUploadTasks((prev) => {
      const t = prev.find((x) => x.id === id && x.status === 'pending')
      if (t) revokeTaskPreview(t)
      return prev.filter((x) => !(x.id === id && x.status === 'pending'))
    })
  }, [])

  const clearPendingUploads = useCallback(() => {
    setUploadTasks((prev) => {
      for (const t of prev) {
        if (t.status === 'pending') revokeTaskPreview(t)
      }
      return prev.filter((t) => t.status !== 'pending')
    })
  }, [])

  const retryUploadTask = useCallback(
    (id: string) => {
      setUploadTasks((prev) => {
        const t = prev.find((x) => x.id === id && x.status === 'error')
        if (!t) return prev
        const patched: CosUploadTask = {
          ...t,
          status: 'pending',
          percent: 0,
          errorMessage: undefined,
        }
        queueMicrotask(() => void startUploads([patched]))
        return prev.map((x) => (x.id === id ? patched : x))
      })
    },
    [startUploads]
  )

  const retryAllFailed = useCallback(() => {
    setUploadTasks((prev) => {
      const failed = prev.filter((t) => t.status === 'error')
      if (failed.length === 0) return prev
      const patched: CosUploadTask[] = failed.map((t) => ({
        ...t,
        status: 'pending' as const,
        percent: 0,
        errorMessage: undefined,
      }))
      const byId = new Map(patched.map((t) => [t.id, t]))
      queueMicrotask(() => void startUploads(patched))
      return prev.map((t) => byId.get(t.id) ?? t)
    })
  }, [startUploads])

  const onUploadFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    e.target.value = ''
    if (!files?.length) return
    if (isUploading) {
      message.warning('上传进行中，请稍后再添加文件')
      return
    }
    const au = autoUploadAfterSelect
    const added = enqueueImageFiles(Array.from(files), { willAutoUpload: au })
    if (au && added.length > 0) void startUploads(added)
  }

  const onUploadDropZoneDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!uploadDropZoneBusy) setUploadDropActive(true)
  }

  const onUploadDropZoneDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setUploadDropActive(false)
  }

  const onUploadDropZoneDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setUploadDropActive(false)
    if (uploadDropZoneBusy) {
      if (isUploading) message.warning('上传进行中，请稍后再添加文件')
      return
    }
    void (async () => {
      setUploadScanning(true)
      try {
        const files = await collectImageFilesFromDataTransfer(e.dataTransfer)
        if (!uploadModalOpenRef.current) return
        const au = autoUploadAfterSelect
        const added = enqueueImageFiles(files, { willAutoUpload: au })
        if (au && added.length > 0) void startUploads(added)
      } catch {
        message.error('读取拖拽内容失败')
      } finally {
        setUploadScanning(false)
      }
    })()
  }

  const onUploadDropZoneClick = () => {
    if (uploadDropZoneBusy) {
      if (isUploading) message.warning('上传进行中，请稍后再添加文件')
      else if (uploadScanning) message.info('正在读取文件，请稍候')
      return
    }
    fileInputRef.current?.click()
  }

  const onUploadDropZoneKeyDown = (e: KeyboardEvent) => {
    if (uploadDropZoneBusy) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  const openUploadModal = useCallback(() => {
    setUploadModalOpen(true)
  }, [])

  const closeUploadModal = useCallback(() => {
    setUploadTasks((prev) => {
      for (const t of prev) {
        revokeTaskPreview(t)
      }
      return []
    })
    setUploadModalOpen(false)
    setUploadDropActive(false)
    setUploadScanning(false)
  }, [])

  const primaryUploadButtonLabel = useMemo(() => {
    if (pendingCount === 0) return '开始上传'
    return autoUploadAfterSelect ? `立即上传（${pendingCount}）` : `开始上传（${pendingCount}）`
  }, [pendingCount, autoUploadAfterSelect])

  const handleMainCardDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleMainCardDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isUploading || uploadScanning) {
      message.warning('请等待当前处理结束后再拖入')
      return
    }
    setUploadModalOpen(true)
    void (async () => {
      setUploadScanning(true)
      try {
        const files = await collectImageFilesFromDataTransfer(e.dataTransfer)
        const au = autoUploadAfterSelect
        const added = enqueueImageFiles(files, { willAutoUpload: au })
        if (au && added.length > 0) void startUploads(added)
      } catch {
        message.error('读取拖拽内容失败')
      } finally {
        setUploadScanning(false)
      }
    })()
  }

  return {
    fileInputRef,
    uploadModalOpen,
    uploadTasks,
    uploadDropActive,
    uploadScanning,
    autoUploadAfterSelect,
    setAutoUploadAfterSelect,
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
  }
}
