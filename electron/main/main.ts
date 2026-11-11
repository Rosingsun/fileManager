import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Menu, protocol } from 'electron'
import { basename, dirname, join, normalize, parse } from 'path'
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync as nodeFileExistsSync, unlinkSync } from 'fs'
import fs from 'fs-extra'
import { watch } from 'chokidar'
import sharp from 'sharp'
import crypto from 'crypto'
import type { OrganizeConfig, FileInfo, SimilarityScanConfig, ImageHash, SimilarityGroup, SimilarityScanProgress, SimilarityScanResult, ImageContentCategory, ImageClassificationResult, ImageClassificationConfig, ImageClassificationProgress, ImageClassificationBatchResult, ImageQualityScanConfig, ImageQualityScanResult, ImageQualityScanProgress, BatchFileOpResult, BatchRelocateEntry, FileConflictAction } from '../../src/types'
import { scanImageQuality, computePhotoQualityTierForImage } from './services/imageQualityService'
import type { ClassificationModelId } from './utils/classificationModels'
export type { ClassificationModelId } from './utils/classificationModels'
import { CLASSIFICATION_MODELS, getClassificationModelPath, getModelInfo, MODEL_FILE_NAMES, modelIdFromOnnxBasename, getModelsDir, ensureModelsDir } from './utils/classificationModels'
import { resolveProjectRoot } from './utils/projectRoot'
import { downloadModelFile } from './utils/modelDownload'
import {
  CLASSIFICATION_PRESETS,
  getPresetById,
  getPresetRequiredModelIds,
  isPresetId,
  isPresetDownloadId,
  parseDownloadTargetId,
  legacyModelIdToPreset,
  type ClassificationPresetId
} from './utils/classificationPresets'
import { classifyImage as runClassifyImage, clearImagenetSessionCache } from './services/imageClassificationService'
import { clearClipModelCache } from './utils/clipClassifier'
import { readShutterCountFromFile, shutdownExiftool } from './utils/shutterCount'
import { IMAGE_EXTENSIONS } from './utils/fileUtils'
import { probeMediaAsset, shutdownMediaAssetCache } from './services/mediaAssetService'
import { getMainCacheOverview, clearMainCache, type MainCacheScope } from './services/cacheService'
import { registerMediaLocalProtocol } from './utils/mediaLocalProtocol'
import { registerCloudIpc } from './ipc/cloudIpc'

function authRefreshTokenPath(): string {
  return join(app.getPath('userData'), 'auth-refresh.enc')
}

let mainProcessCurrentUserId: string | null = null

function operationLogsRoot(): string {
  return join(app.getPath('userData'), 'operation-logs')
}

function operationLogFile(userId: string): string {
  return join(operationLogsRoot(), `${userId}.jsonl`)
}

function appendOperationLogLine(
  userId: string,
  entry: { id: string; ts: number; action: string; summary?: string; detail?: string }
): void {
  try {
    mkdirSync(operationLogsRoot(), { recursive: true })
    appendFileSync(operationLogFile(userId), `${JSON.stringify(entry)}\n`, 'utf8')
  } catch (e) {
    console.error('[oplog] append failed', e)
  }
}

function readOperationLogEntries(userId: string, limit: number): Array<{
  id: string
  ts: number
  action: string
  summary?: string
  detail?: string
}> {
  const p = operationLogFile(userId)
  if (!nodeFileExistsSync(p)) return []
  try {
    const raw = readFileSync(p, 'utf8')
    const lines = raw.split(/\r?\n/).filter(Boolean)
    const parsed: Array<{ id: string; ts: number; action: string; summary?: string; detail?: string }> = []
    for (const line of lines) {
      try {
        const o = JSON.parse(line) as Record<string, unknown>
        if (typeof o.id === 'string' && typeof o.ts === 'number' && typeof o.action === 'string') {
          parsed.push({
            id: o.id,
            ts: o.ts,
            action: o.action,
            summary: typeof o.summary === 'string' ? o.summary : undefined,
            detail: typeof o.detail === 'string' ? o.detail : undefined,
          })
        }
      } catch {
        /* skip bad line */
      }
    }
    parsed.sort((a, b) => b.ts - a.ts)
    return parsed.slice(0, Math.max(1, Math.min(limit, 500)))
  } catch (e) {
    console.error('[oplog] read failed', e)
    return []
  }
}

function clearOperationLogFile(userId: string): void {
  const p = operationLogFile(userId)
  if (nodeFileExistsSync(p)) {
    try {
      unlinkSync(p)
    } catch (e) {
      console.error('[oplog] clear failed', e)
    }
  }
}

const { readdir, stat, mkdir, move, existsSync } = fs

/** 开发环境主进程热重载会重复执行本模块，须先移除旧 invoke handler 再注册 */
function ipcHandle(channel: string, listener: (...args: unknown[]) => unknown): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener as Parameters<typeof ipcMain.handle>[1])
}

function uniqueFilePathInDir(dir: string, filename: string): string {
  let candidate = join(dir, filename)
  let n = 1
  const { name, ext } = parse(filename)
  while (existsSync(candidate)) {
    candidate = join(dir, `${name}_${n}${ext}`)
    n += 1
  }
  return candidate
}

// 获取文件的 MIME 类型
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    // 图片类型
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    // 视频类型
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'mkv': 'video/x-matroska',
    // 音频类型
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    // 默认类型
    '': 'application/octet-stream'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// 获取预加载脚本路径
function getPreloadPath(): string {
  // 尝试多个可能的路径
  const possiblePaths = [
    // 生产环境路径
    join(__dirname, '../preload/preload.mjs'),
    join(__dirname, '../preload/preload.js'),
    // 开发环境路径（electron-vite 输出）
    join(process.cwd(), 'dist-electron/preload/preload.mjs'),
    join(process.cwd(), 'dist-electron/preload/preload.js'),
    // 备用路径
    join(process.cwd(), 'out/preload/preload.mjs'),
    join(process.cwd(), 'out/preload/preload.js'),
    // 相对路径（开发环境）
    join(__dirname, '../../dist-electron/preload/preload.mjs'),
    join(__dirname, '../../out/preload/preload.mjs')
  ]
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log('[Main] 使用预加载脚本路径:', path)
      return path
    }
  }
  
  // 如果都找不到，抛出错误而不是使用可能不存在的默认路径
  const errorMsg = `预加载脚本未找到！已尝试的路径：\n${possiblePaths.join('\n')}`
  console.error('[Main]', errorMsg)
  throw new Error(errorMsg)
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media-local',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
])

// 设置缓存目录，避免权限问题
// 必须在 app.whenReady() 之前调用
if (process.platform === 'win32') {
  try {
    const userDataPath = app.getPath('userData')
    const cachePath = join(userDataPath, 'cache')
    if (!existsSync(cachePath)) {
      mkdirSync(cachePath, { recursive: true })
    }
    app.setPath('cache', cachePath)
  } catch (error) {
    // 忽略缓存目录设置错误，使用默认路径
    console.warn('无法设置缓存目录，将使用默认路径:', error)
  }
}

let mainWindow: BrowserWindow | undefined = undefined
let fileWatcher: ReturnType<typeof watch> | null = null

function createWindow() {
  let preloadPath: string
  try {
    preloadPath = getPreloadPath()
  } catch (error: any) {
    console.error('[Main] 无法获取预加载脚本路径:', error.message)
    dialog.showErrorBox(
      '预加载脚本错误',
      `无法找到预加载脚本：\n${error.message}\n\n请确保已正确构建项目。`
    )
    app.quit()
    return
  }
  
  console.log('[Main] 创建窗口，preload 路径:', preloadPath)
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false // 允许 preload 脚本访问 Node.js API
    }
  })
  
  // 监听预加载脚本加载错误
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Main] 页面加载失败:', errorCode, errorDescription, validatedURL)
  })
  
  // 监听预加载脚本错误
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[Main] 预加载脚本错误:', preloadPath, error)
    dialog.showErrorBox(
      '预加载脚本执行错误',
      `预加载脚本执行失败：\n${error.message}\n\n路径：${preloadPath}`
    )
  })
  
  // 监听预加载脚本加载完成
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Page loaded successfully')
    // 检查 electronAPI 是否已注入
    mainWindow?.webContents.executeJavaScript('window.electronAPI ? "injected" : "not injected"')
      .then((result) => {
        console.log('[Main] electronAPI status:', result)
      })
      .catch((error) => {
        console.error('[Main] Failed to check electronAPI status:', error)
      })
  })

  // 开发环境加载 Vite 开发服务器，生产环境加载构建文件
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // electron-vite 构建后，renderer 输出到 dist/ 目录
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('close', () => {
    const uid = mainProcessCurrentUserId
    if (uid) {
      appendOperationLogLine(uid, {
        id: crypto.randomUUID(),
        ts: Date.now(),
        action: 'app_closed',
        summary: '关闭应用',
      })
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = undefined
    if (fileWatcher) {
      fileWatcher.close()
      fileWatcher = null
    }
  })
}

/** 未打包时提供菜单/F12，便于在关掉自动打开的 DevTools 后仍能查看 Network */
function setupDevToolsMenu(): void {
  if (app.isPackaged) return
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: '开发',
        submenu: [
          {
            label: '切换开发者工具',
            accelerator: 'F12',
            click: () => {
              const w = BrowserWindow.getFocusedWindow()
              if (w) w.webContents.toggleDevTools()
            },
          },
          { type: 'separator' },
          {
            label: '重新加载界面',
            accelerator: 'Ctrl+R',
            click: () => {
              BrowserWindow.getFocusedWindow()?.reload()
            },
          },
        ],
      },
    ])
  )
}

app.whenReady().then(() => {
  registerMediaLocalProtocol()
  registerCloudIpc()
  setupDevToolsMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void shutdownExiftool()
  void shutdownMediaAssetCache()
})

// IPC 处理器：打开文件
ipcHandle('file:open', async (_event, filePath: string): Promise<boolean> => {
  try {
    // 使用系统默认程序打开文件
    const result = await shell.openPath(filePath)
    if (result) {
      console.error('[Main] 打开文件失败:', result)
      return false
    }
    console.log('[Main] 文件打开成功:', filePath)
    return true
  } catch (error) {
    console.error('[Main] 打开文件失败:', error)
    return false
  }
})

// IPC 处理器：打开目录选择对话框
ipcHandle('dialog:openDirectory', async () => {
  if (!mainWindow) return null
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择要整理的目录'
  })
  
  if (result.canceled) {
    return null
  }
  return result.filePaths[0]
})

// IPC 处理器：打开外部链接
ipcHandle('shell:openExternal', async (_event, url: string): Promise<boolean> => {
  try {
    const { shell } = await import('electron')
    await shell.openExternal(url)
    return true
  } catch (error) {
    console.error('[Main] 打开外部链接失败:', error)
    return false
  }
})

// 并发 stat 将一条目转为 FileInfo（folder-name/extension 过滤由上层决定，这里只负责 stat）
async function statEntry(fullPath: string, name: string): Promise<FileInfo> {
  const stats = await stat(fullPath)
  return {
    name,
    path: fullPath,
    isDirectory: stats.isDirectory(),
    size: stats.size,
    modifiedTime: stats.mtime.getTime(),
    createdTime: stats.birthtime.getTime()
  }
}

// 以并发度限制批量 stat 一组条目，避免大目录串行 stat 拖慢
async function statEntries(
  entries: Array<{ name: string; path: string }>,
  concurrency = 64
): Promise<FileInfo[]> {
  const results: Array<FileInfo | null> = new Array(entries.length)
  let next = 0

  async function worker() {
    while (next < entries.length) {
      const idx = next
      next += 1
      try {
        results[idx] = await statEntry(entries[idx].path, entries[idx].name)
      } catch {
        results[idx] = null
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, () => worker())
  await Promise.all(workers)

  return results.filter((r): r is FileInfo => r !== null)
}

// 排序：文件夹在前，然后按名称排序（稳定，供分页切段使用）
function sortDirectoryItems(items: FileInfo[]): FileInfo[] {
  return items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

// IPC 处理器：读取目录内容（全量，供必须看整目录的功能/惰性全量副本使用；内部并发 stat 提速）
ipcHandle('fs:readDirectory', async (_event, path: string): Promise<FileInfo[]> => {
  try {
    if (!existsSync(path)) {
      return []
    }

    const dirents = await readdir(path, { withFileTypes: true })
    const entries = dirents.map((d) => ({ name: d.name, path: join(path, d.name) }))
    const fileInfos = await statEntries(entries)
    return sortDirectoryItems(fileInfos)
  } catch (error) {
    console.error('读取目录失败:', error)
    throw error
  }
})

// IPC 处理器：分页读取目录内容，返回按「文件夹在前→名称」稳定排序切片 + 过滤后总数。
// offset/limit 基于排序后的整表切段，保证滚动追加不重复/不缺漏；仅对目标切片做 stat。
ipcHandle(
  'fs:readDirectoryPage',
  async (
    _event,
    path: string,
    options: { offset: number; limit: number; extensions?: string[] }
  ): Promise<{ items: FileInfo[]; totalCount: number; hasMore: boolean }> => {
    try {
      if (!existsSync(path)) {
        return { items: [], totalCount: 0, hasMore: false }
      }

      const extFilter = options.extensions && options.extensions.length > 0
        ? new Set(options.extensions.map((e) => e.toLowerCase()))
        : null

      // 第一步：仅用 dirent 的 isDirectory 与扩展名做轻量排序/过滤，得到排序表（此时不 stat）
      const dirents = await readdir(path, { withFileTypes: true })
      const skeleton = dirents.map((d) => ({
        name: d.name,
        path: join(path, d.name),
        isDirectory: d.isDirectory()
      }))

      skeleton.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })

      // 应用扩展名过滤（仅针对文件；文件夹仍保留，便于浏览子目录）
      const matched: typeof skeleton = []
      for (const s of skeleton) {
        if (extFilter && !s.isDirectory) {
          const dot = s.name.lastIndexOf('.')
          const ext = dot >= 0 ? s.name.slice(dot + 1).toLowerCase() : ''
          if (!extFilter.has(ext)) continue
        }
        matched.push(s)
      }

      const totalCount = matched.length
      const offset = Math.max(0, Math.floor(options.offset || 0))
      const limit = Math.max(1, Math.floor(options.limit || 15))
      const slice = matched.slice(offset, offset + limit)

      // 第二步：仅对目标切片并发 stat
      const items = await statEntries(slice)

      return {
        items,
        totalCount,
        hasMore: offset + slice.length < totalCount
      }
    } catch (error) {
      console.error('分页读取目录失败:', error)
      throw error
    }
  }
)

// 递归获取目录下所有文件
async function getAllFiles(dirPath: string, extensions: string[]): Promise<Array<{ path: string; name: string }>> {
  const files: Array<{ path: string; name: string }> = []
  
  async function traverse(currentPath: string) {
    try {
      const items = await readdir(currentPath)
      
      for (const item of items) {
        const fullPath = join(currentPath, item)
        const stats = await stat(fullPath)
        
        if (stats.isDirectory()) {
          // 递归遍历子目录
          await traverse(fullPath)
        } else {
          // 检查文件扩展名是否匹配
          const ext = item.split('.').pop()?.toLowerCase() || ''
          if (extensions.length === 0 || extensions.includes(ext)) {
            files.push({ path: fullPath, name: item })
          }
        }
      }
    } catch (error) {
      console.error(`遍历目录失败 ${currentPath}:`, error)
    }
  }
  
  await traverse(dirPath)
  return files
}

// 递归读取目录，返回所有文件和文件夹的 FileInfo
async function readDirectoryRecursive(dirPath: string): Promise<FileInfo[]> {
  const fileInfos: FileInfo[] = []
  
  async function traverse(currentPath: string) {
    try {
      const items = await readdir(currentPath)
      
      for (const item of items) {
        const fullPath = join(currentPath, item)
        const stats = await stat(fullPath)
        
        fileInfos.push({
          name: item,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modifiedTime: stats.mtime.getTime(),
          createdTime: stats.birthtime.getTime()
        })
        
        if (stats.isDirectory()) {
          // 递归遍历子目录
          await traverse(fullPath)
        }
      }
    } catch (error) {
      console.error(`遍历目录失败 ${currentPath}:`, error)
    }
  }
  
  await traverse(dirPath)
  return fileInfos
}

// IPC 处理器：递归读取目录
ipcHandle('fs:readDirectoryRecursive', async (_event, path: string): Promise<FileInfo[]> => {
  try {
    if (!existsSync(path)) {
      return []
    }
    return await readDirectoryRecursive(path)
  } catch (error) {
    console.error('递归读取目录失败:', error)
    throw error
  }
})

// IPC 处理器：提取文件（将子目录中的指定类型文件提取到当前目录）
ipcHandle('fs:extractFiles', async (_event, targetPath: string, filters: { extensions: string[]; minSize?: number; maxSize?: number; category?: string }, conflictAction: 'skip' | 'overwrite' | 'rename') => {
  try {
    if (!existsSync(targetPath)) {
      throw new Error('目标目录不存在')
    }

    const { extensions, minSize, maxSize, category } = filters
    const results: Array<{ from: string; to: string; success: boolean; error?: string }> = []
    
    // 获取所有匹配的文件（不包括目标目录本身的文件）。extensions 为空表示不过滤扩展名。
    let allFiles = await getAllFiles(targetPath, extensions || [])
    
    // 过滤掉已经在目标目录中的文件
    let filesToExtract = allFiles.filter(file => {
      const fileDir = file.path.substring(0, file.path.lastIndexOf(file.name) - 1)
      return fileDir !== targetPath
    })

    // 应用大小过滤
    if (minSize !== undefined) {
      filesToExtract = filesToExtract.filter(f => {
        try {
          const stats = fs.statSync(f.path)
          return stats.size >= minSize
        } catch {
          return false
        }
      })
    }
    if (maxSize !== undefined) {
      filesToExtract = filesToExtract.filter(f => {
        try {
          const stats = fs.statSync(f.path)
          return stats.size <= maxSize
        } catch {
          return false
        }
      })
    }

    for (const file of filesToExtract) {
      const targetFile = join(targetPath, file.name)
      
      // 处理文件名冲突
      let finalTargetFile = targetFile
      if (existsSync(finalTargetFile)) {
        if (conflictAction === 'skip') {
          results.push({
            from: file.path,
            to: targetFile,
            success: false,
            error: '文件已存在，跳过'
          })
          continue
        } else if (conflictAction === 'rename') {
          let counter = 1
          const ext = file.name.split('.').pop()
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'))
          while (existsSync(finalTargetFile)) {
            finalTargetFile = join(targetPath, `${nameWithoutExt}_${counter}.${ext}`)
            counter++
          }
        }
      }

      try {
        await move(file.path, finalTargetFile, { overwrite: conflictAction === 'overwrite' })
        results.push({
          from: file.path,
          to: finalTargetFile,
          success: true
        })
      } catch (error: any) {
        results.push({
          from: file.path,
          to: finalTargetFile,
          success: false,
          error: error.message
        })
      }
    }

    return results
  } catch (error: any) {
    console.error('提取文件失败:', error)
    throw error
  }
})

// IPC 处理器：整理文件
ipcHandle('fs:organize', async (_event, config: OrganizeConfig) => {
  try {
    const { sourcePath, rules, options } = config
    const results: Array<{ from: string; to: string; success: boolean; error?: string }> = []

    // 读取源目录所有文件
    const items = await readdir(sourcePath)
    
    for (const item of items) {
      const sourceFile = join(sourcePath, item)
      const stats = await stat(sourceFile)
      
      // 跳过目录（如果需要递归处理，可以在这里扩展）
      if (stats.isDirectory() && !options.includeSubdirectories) {
        continue
      }

      // 跳过目录本身
      if (stats.isDirectory()) {
        continue
      }

      // 根据规则确定目标路径
      let targetDir = sourcePath
      
      if (rules.type === 'extension') {
        // 按扩展名分类
        const ext = item.split('.').pop()?.toLowerCase() || 'other'
        targetDir = join(sourcePath, ext)
      } else if (rules.type === 'date') {
        // 按修改日期分类
        const date = new Date(stats.mtime)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        
        if (rules.dateFormat === 'year') {
          targetDir = join(sourcePath, String(year))
        } else if (rules.dateFormat === 'month') {
          targetDir = join(sourcePath, String(year), String(month))
        } else {
          targetDir = join(sourcePath, String(year), String(month), String(day))
        }
      } else if (rules.type === 'size') {
        // 按文件大小分类
        const sizeMB = stats.size / (1024 * 1024)
        let sizeCategory = 'small'
        if (sizeMB > 100) sizeCategory = 'large'
        else if (sizeMB > 10) sizeCategory = 'medium'
        targetDir = join(sourcePath, sizeCategory)
      } else if (rules.type === 'custom' && rules.pattern) {
        // 自定义规则（正则表达式）
        const match = item.match(new RegExp(rules.pattern))
        if (match && match[1]) {
          targetDir = join(sourcePath, match[1])
        }
      }

      // 确保目标目录存在
      await mkdir(targetDir, { recursive: true })
      
      const targetFile = join(targetDir, item)
      
      // 处理文件名冲突
      let finalTargetFile = targetFile
      if (existsSync(finalTargetFile) && options.conflictAction === 'rename') {
        let counter = 1
        const ext = item.split('.').pop()
        const nameWithoutExt = item.substring(0, item.lastIndexOf('.'))
        while (existsSync(finalTargetFile)) {
          finalTargetFile = join(targetDir, `${nameWithoutExt}_${counter}.${ext}`)
          counter++
        }
      }

      try {
        await move(sourceFile, finalTargetFile, { overwrite: options.conflictAction === 'overwrite' })
        results.push({
          from: sourceFile,
          to: finalTargetFile,
          success: true
        })
      } catch (error: any) {
        results.push({
          from: sourceFile,
          to: finalTargetFile,
          success: false,
          error: error.message
        })
      }
    }

    return results
  } catch (error: any) {
    console.error('整理文件失败:', error)
    throw error
  }
})

// IPC 处理器：获取应用版本
ipcHandle('app:getVersion', () => {
  return app.getVersion()
})

// IPC 处理器：获取平台信息
ipcHandle('app:getPlatform', () => {
  return process.platform
})

ipcHandle('cache:getOverview', async () => {
  return await getMainCacheOverview()
})

ipcHandle('cache:clear', async (_event, scopes: unknown) => {
  const list = Array.isArray(scopes)
    ? scopes.filter((s): s is MainCacheScope => s === 'previewDisk' || s === 'chromiumDisk' || s === 'modelSessions')
    : []
  if (list.length === 0) return
  await clearMainCache(list)
})

ipcHandle('auth:saveRefreshToken', async (_event, token: string): Promise<{ ok: boolean; error?: string }> => {
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: 'encryption_unavailable' }
  }
  try {
    const buf = safeStorage.encryptString(token)
    writeFileSync(authRefreshTokenPath(), buf)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

ipcHandle('auth:loadRefreshToken', async (): Promise<string | null> => {
  if (!safeStorage.isEncryptionAvailable()) {
    return null
  }
  const p = authRefreshTokenPath()
  if (!nodeFileExistsSync(p)) {
    return null
  }
  try {
    const buf = readFileSync(p)
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
})

ipcHandle('auth:clearRefreshToken', async (): Promise<void> => {
  const p = authRefreshTokenPath()
  if (nodeFileExistsSync(p)) {
    try {
      unlinkSync(p)
    } catch {
      /* ignore */
    }
  }
})

ipcHandle('app:setCurrentUserId', async (_event, userId: unknown): Promise<void> => {
  mainProcessCurrentUserId = typeof userId === 'string' && userId.length > 0 ? userId : null
})

ipcHandle(
  'oplog:append',
  async (
    _event,
    payload: { userId?: string; action?: string; summary?: string; detail?: string }
  ): Promise<void> => {
    const userId = typeof payload?.userId === 'string' ? payload.userId.trim() : ''
    const action = typeof payload?.action === 'string' ? payload.action.trim() : ''
    if (!userId || !action) return
    appendOperationLogLine(userId, {
      id: crypto.randomUUID(),
      ts: Date.now(),
      action,
      summary: typeof payload.summary === 'string' ? payload.summary : undefined,
      detail: typeof payload.detail === 'string' ? payload.detail : undefined,
    })
  }
)

ipcHandle('oplog:list', async (_event, userId: unknown, limit = 200): Promise<
  Array<{ id: string; ts: number; action: string; summary?: string; detail?: string }>
> => {
  const uid = typeof userId === 'string' ? userId.trim() : ''
  if (!uid) return []
  const n = typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : 200
  return readOperationLogEntries(uid, n)
})

ipcHandle('oplog:clear', async (_event, userId: unknown): Promise<void> => {
  const uid = typeof userId === 'string' ? userId.trim() : ''
  if (!uid) return
  clearOperationLogFile(uid)
})

// IPC 处理器：窗口控制
ipcMain.on('window:minimize', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.on('window:close', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

// IPC 处理器：文件预览
ipcMain.on('file:preview', (_event, filePath: string, fileList?: FileInfo[], currentIndex?: number) => {
  // 创建预览窗口
  const previewWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: `预览 - ${filePath.split('\\').pop() || filePath.split('/').pop()}`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // 允许加载本地文件
      preload: getPreloadPath()
    },
    parent: mainWindow,
    modal: false
  })

  // 生成预览HTML内容
  const fileName = filePath.split('\\').pop() || filePath.split('/').pop() || ''
  const fileExt = fileName.split('.').pop()?.toLowerCase() || ''
  
  let content = ''
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(fileExt)) {
    // 图片预览
    const normalizedPath = filePath.replace(/\\/g, '/')
    const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/')

    // 准备导航数据
    let prevImage: FileInfo | null = null
    let nextImage: FileInfo | null = null
    let prevIndex = -1
    let nextIndex = -1

    if (fileList && currentIndex !== undefined) {
      // 过滤出图片文件
      const imageFiles = fileList.filter(f => !f.isDirectory && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(f.name.split('.').pop()?.toLowerCase() || ''))
      const currentImageIndex = imageFiles.findIndex(f => f.path === filePath)
      if (currentImageIndex > 0) {
        prevImage = imageFiles[currentImageIndex - 1]
        prevIndex = currentImageIndex - 1
      }
      if (currentImageIndex < imageFiles.length - 1) {
        nextImage = imageFiles[currentImageIndex + 1]
        nextIndex = currentImageIndex + 1
      }
    }

    content = `
      <div style="position: relative; height: 100vh; background: #f0f0f0; display: flex; flex-direction: column;">
        ${prevImage ? `<button id="prevBtn" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); z-index: 10; padding: 10px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 5px; cursor: pointer;">◀ 上一张</button>` : ''}
        ${nextImage ? `<button id="nextBtn" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); z-index: 10; padding: 10px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 5px; cursor: pointer;">下一张 ▶</button>` : ''}
        <div style="flex: 1; display: flex; justify-content: center; align-items: center;">
          <img id="previewImg" src="file:///${encodedPath}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="${fileName}" />
        </div>
      </div>
      <script>
        ${prevImage ? `document.getElementById('prevBtn').addEventListener('click', () => {
          window.electronAPI.previewFile('${prevImage.path.replace(/\\/g, '\\\\')}', ${JSON.stringify(fileList)}, ${prevIndex})
        })` : ''}
        ${nextImage ? `document.getElementById('nextBtn').addEventListener('click', () => {
          window.electronAPI.previewFile('${nextImage.path.replace(/\\/g, '\\\\')}', ${JSON.stringify(fileList)}, ${nextIndex})
        })` : ''}
      </script>
    `
    content = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0;">
        <img src="file:///${encodedPath}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="${fileName}" />
      </div>
    `
  } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'].includes(fileExt)) {
    // 视频预览
    const normalizedPath = filePath.replace(/\\/g, '/')
    const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/')
    content = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #000;">
        <video controls style="max-width: 100%; max-height: 100%;" autoplay>
          <source src="file:///${encodedPath}" type="video/${fileExt === 'mkv' ? 'x-matroska' : fileExt}">
          您的浏览器不支持视频播放。
        </video>
      </div>
    `
  } else if (['mp3', 'wav', 'flac', 'aac'].includes(fileExt)) {
    // 音频预览
    const normalizedPath = filePath.replace(/\\/g, '/')
    const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/')
    content = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0;">
        <h2 style="margin-bottom: 20px;">${fileName}</h2>
        <audio controls style="width: 80%;" autoplay>
          <source src="file:///${encodedPath}" type="audio/${fileExt === 'aac' ? 'aac' : fileExt}">
          您的浏览器不支持音频播放。
        </audio>
      </div>
    `
  } else {
    // 其他文件类型，显示文件信息
    content = `
      <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0;">
        <h2>无法预览此文件类型</h2>
        <p>文件: ${fileName}</p>
        <p>类型: ${fileExt.toUpperCase()}</p>
      </div>
    `
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>文件预览</title>
      <style>
        body { margin: 0; font-family: Arial, sans-serif; }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `

  // 加载HTML内容
  previewWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
})

// IPC 处理器：文件重命名
ipcHandle('file:rename', async (_event, oldPath: string, newName: string): Promise<boolean> => {
  try {
    const dir = oldPath.substring(0, oldPath.lastIndexOf('\\') || oldPath.lastIndexOf('/'))
    const newPath = `${dir}/${newName}`
    await move(oldPath, newPath)
    console.log('[Main] 文件重命名成功:', oldPath, '->', newPath)
    return true
  } catch (error) {
    console.error('[Main] 文件重命名失败:', error)
    return false
  }
})

// IPC 处理器：删除文件或文件夹
ipcHandle('file:delete', async (_event, filePath: string): Promise<boolean> => {
  try {
    const stats = await stat(filePath)
    if (stats.isDirectory()) {
      await fs.remove(filePath)
      console.log('[Main] 文件夹删除成功:', filePath)
    } else {
      await fs.unlink(filePath)
      console.log('[Main] 文件删除成功:', filePath)
    }
    return true
  } catch (error) {
    console.error('[Main] 删除失败:', error)
    return false
  }
})

ipcHandle('file:move', async (_event, oldPath: string, newPath: string): Promise<boolean> => {
  try {
    const destDir = dirname(newPath)
    await mkdir(destDir, { recursive: true })
    await move(oldPath, newPath, { overwrite: false })
    console.log('[Main] 文件移动成功:', oldPath, '->', newPath)
    return true
  } catch (error) {
    console.error('[Main] 移动失败:', error)
    return false
  }
})

ipcHandle(
  'files:batchCopyToDirectory',
  async (
    _event,
    sources: string[],
    destDir: string,
    conflictAction: FileConflictAction
  ): Promise<BatchFileOpResult[]> => {
    const out: BatchFileOpResult[] = []
    try {
      await mkdir(destDir, { recursive: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return sources.map(s => ({ filePath: s, success: false, error: msg }))
    }
    for (const src of sources) {
      const base = basename(src)
      let dest = join(destDir, base)
      try {
        if (!existsSync(src)) {
          out.push({ filePath: src, success: false, error: '源文件不存在' })
          continue
        }
        if (existsSync(dest)) {
          if (conflictAction === 'skip') {
            out.push({ filePath: src, success: false, error: '目标已存在' })
            continue
          }
          if (conflictAction === 'rename') {
            dest = uniqueFilePathInDir(destDir, base)
          }
        }
        await fs.copy(src, dest, { overwrite: conflictAction === 'overwrite' })
        out.push({ filePath: src, success: true, newPath: dest })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        out.push({ filePath: src, success: false, error: msg })
      }
    }
    return out
  }
)

ipcHandle(
  'files:batchRelocate',
  async (_event, moves: BatchRelocateEntry[], conflictAction: FileConflictAction): Promise<BatchFileOpResult[]> => {
    const out: BatchFileOpResult[] = []
    for (const { from, to } of moves) {
      try {
        if (!existsSync(from)) {
          out.push({ filePath: from, success: false, error: '源文件不存在' })
          continue
        }
        const dir = dirname(to)
        await mkdir(dir, { recursive: true })
        let dest = to
        if (existsSync(dest)) {
          if (conflictAction === 'skip') {
            out.push({ filePath: from, success: false, error: '目标已存在' })
            continue
          }
          if (conflictAction === 'rename') {
            dest = uniqueFilePathInDir(dir, basename(to))
          }
        }
        await move(from, dest, { overwrite: conflictAction === 'overwrite' })
        out.push({ filePath: from, success: true, newPath: dest })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        out.push({ filePath: from, success: false, error: msg })
      }
    }
    return out
  }
)

// IPC 处理器：获取图片base64用于预览
ipcHandle(
  'file:getShutterCount',
  async (_event, filePath: string): Promise<{ count: number | null; message?: string }> => {
    return readShutterCountFromFile(filePath)
  }
)

ipcHandle('file:getPhotoFocusPoints', async (_event, filePath: string) => {
  const { readPhotoFocusPointsFromFile } = await import('./utils/photoFocusPoints')
  return readPhotoFocusPointsFromFile(filePath)
})

ipcHandle('file:getImageBase64', async (_event, filePath: string): Promise<string> => {
  const { getImageBase64 } = await import('./utils/imageUtils')
  return getImageBase64(filePath)
})

ipcHandle('file:probeMediaAsset', async (_event, filePath: string) => {
  return probeMediaAsset(filePath)
})

ipcHandle(
  'file:getFileStats',
  async (
    _event,
    filePath: string
  ): Promise<{ size: number; createdTime: number; modifiedTime: number } | null> => {
    try {
      const stats = await stat(filePath)
      if (!stats.isFile()) return null
      return {
        size: stats.size,
        createdTime: stats.birthtime.getTime(),
        modifiedTime: stats.mtime.getTime()
      }
    } catch (error) {
      console.error('[Main] 读取文件属性失败:', error)
      return null
    }
  }
)

// IPC 处理器：获取图片尺寸信息
ipcHandle('file:getImageDimensions', async (_event, filePath: string): Promise<{ width: number; height: number } | null> => {
  const { getImageDimensions } = await import('./utils/imageUtils')
  return getImageDimensions(filePath)
})

ipcHandle('file:getImageThumbnail', async (_event, filePath: string, size: number = 100, quality: number = 60): Promise<string> => {
  const { getImageThumbnail } = await import('./utils/imageUtils')
  return getImageThumbnail(filePath, size, quality)
})

// ==================== 相似照片检测功能 ====================

// 计算文件MD5哈希
function calculateFileHash(fileBuffer: Buffer): string {
  return crypto.createHash('md5').update(fileBuffer).digest('hex')
}

// 计算感知哈希（pHash）
async function calculatePerceptualHash(imageBuffer: Buffer): Promise<string> {
  try {
    const resized = await sharp(imageBuffer)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer()

    let sum = 0
    for (let i = 0; i < resized.length; i++) {
      sum += resized[i]
    }
    const average = sum / resized.length

    let hash = ''
    for (let i = 0; i < resized.length; i++) {
      hash += resized[i] > average ? '1' : '0'
    }

    return hash
  } catch (error) {
    console.error('[Main] 计算感知哈希失败:', error)
    return ''
  }
}

// 计算两个哈希值的相似度
function calculateSimilarity(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 0

  let differences = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) differences++
  }

  return Math.round(((hash1.length - differences) / hash1.length) * 10000) / 100
}

// 推荐保留的照片
function recommendKeepImage(images: ImageHash[]): string {
  if (images.length === 0) return ''
  if (images.length === 1) return images[0].filePath

  const scores = images.map(img => {
    let score = 0
    if (img.width && img.height) {
      const pixels = img.width * img.height
      const maxPixels = Math.max(...images.map(i => (i.width || 0) * (i.height || 0)))
      score += (pixels / maxPixels) * 40
    }
    const maxSize = Math.max(...images.map(i => i.size))
    score += (img.size / maxSize) * 30
    const maxTime = Math.max(...images.map(i => i.modifiedTime))
    score += (img.modifiedTime / maxTime) * 20
    if (img.perceptualHash) score += 10
    return { path: img.filePath, score }
  })

  scores.sort((a, b) => b.score - a.score)
  return scores[0].path
}

// 分组相似照片
function groupSimilarImages(images: ImageHash[], threshold: number, usePerceptualHash: boolean): SimilarityGroup[] {
  const groups: SimilarityGroup[] = []
  const processed = new Set<string>()

  for (let i = 0; i < images.length; i++) {
    if (processed.has(images[i].filePath)) continue

    const group: ImageHash[] = [images[i]]
    processed.add(images[i].filePath)

    for (let j = i + 1; j < images.length; j++) {
      if (processed.has(images[j].filePath)) continue

      let similarity = 0
      if (images[i].fileHash === images[j].fileHash) {
        similarity = 100
      } else if (usePerceptualHash && images[i].perceptualHash && images[j].perceptualHash) {
        similarity = calculateSimilarity(images[i].perceptualHash!, images[j].perceptualHash!)
      }

      if (similarity >= threshold) {
        group.push(images[j])
        processed.add(images[j].filePath)
      }
    }

    if (group.length >= 2) {
      let totalSimilarity = 0
      let count = 0
      for (let k = 0; k < group.length; k++) {
        for (let l = k + 1; l < group.length; l++) {
          if (group[k].fileHash === group[l].fileHash) {
            totalSimilarity += 100
          } else if (usePerceptualHash && group[k].perceptualHash && group[l].perceptualHash) {
            totalSimilarity += calculateSimilarity(group[k].perceptualHash!, group[l].perceptualHash!)
          }
          count++
        }
      }
      const avgSimilarity = count > 0 ? totalSimilarity / count : 0

      groups.push({
        id: `group-${groups.length + 1}`,
        images: group,
        similarity: Math.round(avgSimilarity * 100) / 100,
        recommendedKeep: recommendKeepImage(group)
      })
    }
  }

  return groups
}

// 扫描图片文件
async function scanImageFiles(config: SimilarityScanConfig): Promise<string[]> {
  const imageFiles: string[] = []
  const excludedPaths = new Set(config.excludedFolders || [])
  const excludedExts = new Set((config.excludedExtensions || []).map(ext => ext.toLowerCase()))

  async function traverse(currentPath: string) {
    try {
      const items = await readdir(currentPath)
      
      for (const item of items) {
        const fullPath = join(currentPath, item)
        const stats = await stat(fullPath)
        
        if (stats.isDirectory()) {
          // 检查是否在排除列表中
          if (!excludedPaths.has(fullPath) && config.includeSubdirectories) {
            await traverse(fullPath)
          }
        } else {
          const ext = item.split('.').pop()?.toLowerCase() || ''
          if (IMAGE_EXTENSIONS.includes(ext) && !excludedExts.has(ext)) {
            // 检查文件大小限制
            if (config.minFileSize && stats.size < config.minFileSize) continue
            if (config.maxFileSize && stats.size > config.maxFileSize) continue
            imageFiles.push(fullPath)
          }
        }
      }
    } catch (error) {
      console.error(`[Main] 遍历目录失败 ${currentPath}:`, error)
    }
  }

  await traverse(config.scanPath)
  return imageFiles
}

// IPC 处理器：扫描相似照片
let currentScanWindow: BrowserWindow | null = null

ipcHandle('similarity:scan', async (event, config: SimilarityScanConfig): Promise<SimilarityScanResult> => {
  const startTime = Date.now()
  let currentProgress = 0
  let totalFiles = 0
  currentScanWindow = BrowserWindow.fromWebContents(event.sender) || null

  const sendProgress = (progress: Partial<SimilarityScanProgress>) => {
    if (currentScanWindow && !currentScanWindow.isDestroyed()) {
      currentScanWindow.webContents.send('similarity:progress', {
        current: currentProgress,
        total: totalFiles,
        status: 'scanning',
        groupsFound: 0,
        ...progress
      } as SimilarityScanProgress)
    }
  }

  try {
    // 1. 扫描图片文件
    sendProgress({ status: 'scanning', currentFile: '正在扫描图片文件...' })
    const imageFiles = await scanImageFiles(config)
    totalFiles = imageFiles.length
    console.log(`[Main] 找到 ${totalFiles} 张图片`)

    if (totalFiles === 0) {
      return {
        groups: [],
        totalImages: 0,
        totalGroups: 0,
        potentialSpaceSaved: 0,
        scanTime: Date.now() - startTime
      }
    }

    // 2. 计算哈希值
    sendProgress({ status: 'hashing', currentFile: '正在计算哈希值...' })
    const imageHashes: ImageHash[] = []
    const usePerceptualHash = config.algorithm === 'phash' || config.algorithm === 'both'

    for (let i = 0; i < imageFiles.length; i++) {
      const filePath = imageFiles[i]
      currentProgress = i + 1
      sendProgress({ 
        status: 'hashing', 
        currentFile: filePath,
        current: currentProgress,
        total: totalFiles
      })

      try {
        const fileBuffer = await fs.readFile(filePath)
        const fileHash = calculateFileHash(fileBuffer)
        const stats = await stat(filePath)

        let perceptualHash: string | undefined
        let width: number | undefined
        let height: number | undefined

        if (usePerceptualHash) {
          try {
            const metadata = await sharp(fileBuffer).metadata()
            width = metadata.width
            height = metadata.height
            perceptualHash = await calculatePerceptualHash(fileBuffer)
          } catch (error) {
            console.warn(`[Main] 无法处理图片 ${filePath}:`, error)
          }
        }

        imageHashes.push({
          filePath,
          fileHash,
          perceptualHash,
          width,
          height,
          size: stats.size,
          modifiedTime: stats.mtime.getTime()
        })
      } catch (error) {
        console.error(`[Main] 处理文件失败 ${filePath}:`, error)
      }
    }

    // 3. 分组相似照片
    sendProgress({ status: 'comparing', currentFile: '正在对比相似照片...' })
    const groups = groupSimilarImages(imageHashes, config.similarityThreshold, usePerceptualHash)

    // 计算可释放空间
    let potentialSpaceSaved = 0
    for (const group of groups) {
      const keepPath = group.recommendedKeep || group.images[0].filePath
      for (const img of group.images) {
        if (img.filePath !== keepPath) {
          potentialSpaceSaved += img.size
        }
      }
    }

    sendProgress({ 
      status: 'completed', 
      groupsFound: groups.length,
      current: totalFiles,
      total: totalFiles
    })

    const result = {
      groups,
      totalImages: imageHashes.length,
      totalGroups: groups.length,
      potentialSpaceSaved,
      scanTime: Date.now() - startTime
    }

    currentScanWindow = null
    return result
  } catch (error) {
    console.error('[Main] 相似照片扫描失败:', error)
    sendProgress({ status: 'error', currentFile: `错误: ${error}` })
    currentScanWindow = null
    throw error
  }
})

// IPC 处理器：取消扫描
ipcMain.on('similarity:cancel', () => {
  currentScanWindow = null
})

let imageQualityScanCancelled = false
let currentImageQualityWindow: BrowserWindow | null = null

ipcHandle('imageQuality:scan', async (event, config: ImageQualityScanConfig): Promise<ImageQualityScanResult> => {
  imageQualityScanCancelled = false
  currentImageQualityWindow = BrowserWindow.fromWebContents(event.sender) || null

  const sendProgress = (progress: Partial<ImageQualityScanProgress>) => {
    if (currentImageQualityWindow && !currentImageQualityWindow.isDestroyed()) {
      currentImageQualityWindow.webContents.send('imageQuality:progress', {
        current: 0,
        total: 0,
        status: 'analyzing',
        ...progress
      } as ImageQualityScanProgress)
    }
  }

  try {
    const result = await scanImageQuality(config, sendProgress, () => imageQualityScanCancelled)
    currentImageQualityWindow = null
    return result
  } catch (error) {
    console.error('[Main] 图片质量扫描失败:', error)
    sendProgress({ status: 'error', currentFile: `错误: ${error}` })
    currentImageQualityWindow = null
    throw error
  }
})

ipcMain.on('imageQuality:cancel', () => {
  imageQualityScanCancelled = true
})

// ==================== 图片内容分类（CLIP + ImageNet 九大类）====================

function clearModelCache(modelId?: ClassificationModelId): void {
  clearImagenetSessionCache(modelId)
  clearClipModelCache()
}

async function classifyImage(
  imagePath: string,
  presetOrModelId?: string
): Promise<ImageClassificationResult> {
  const base = await runClassifyImage(imagePath, resolveProjectRoot(), presetOrModelId)
  try {
    const quality = await computePhotoQualityTierForImage(imagePath)
    return { ...base, quality }
  } catch (e) {
    console.warn('[Main] 照片质量档位计算失败:', imagePath, e)
    return { ...base, quality: 'low' }
  }
}

ipcHandle('image:classify', async (_event, imagePath: string, presetOrModelId?: string): Promise<ImageClassificationResult> => {
  return await classifyImage(imagePath, presetOrModelId)
})

// IPC 处理器：批量分类图片
let currentClassificationWindow: BrowserWindow | null = null
let classificationCancelled = false

ipcHandle('image:classifyBatch', async (event, config: ImageClassificationConfig): Promise<ImageClassificationBatchResult> => {
  const startTime = Date.now()
  currentClassificationWindow = BrowserWindow.fromWebContents(event.sender) || null
  classificationCancelled = false
  
  const sendProgress = (progress: Partial<ImageClassificationProgress>) => {
    if (currentClassificationWindow && !currentClassificationWindow.isDestroyed()) {
      currentClassificationWindow.webContents.send('image:classificationProgress', {
        current: 0,
        total: 0,
        status: 'loading',
        ...progress
      } as ImageClassificationProgress)
    }
  }
  
  try {
    // 收集所有图片路径
    sendProgress({ status: 'loading', currentFile: '正在扫描图片文件...' })
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    const imagePaths: string[] = []
    
    const scanImages = async (dir: string) => {
      if (classificationCancelled) return
      
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (classificationCancelled) return
          
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory() && config.includeSubdirectories) {
            await scanImages(fullPath)
          } else if (entry.isFile()) {
            const ext = entry.name.toLowerCase().substring(entry.name.lastIndexOf('.'))
            if (imageExtensions.includes(ext)) {
              imagePaths.push(fullPath)
            }
          }
        }
      } catch (error) {
        console.warn('[Main] 扫描目录失败:', dir, error)
      }
    }
    
    // 如果提供了路径列表，直接使用；否则扫描目录
    if (config.imagePaths && config.imagePaths.length > 0) {
      imagePaths.push(...config.imagePaths)
    }
    
    const totalImages = imagePaths.length
    if (totalImages === 0) {
      return {
        results: [],
        totalImages: 0,
        successCount: 0,
        errorCount: 0,
        classificationTime: Date.now() - startTime
      }
    }
    
    // 批量分类
    sendProgress({ status: 'classifying', current: 0, total: totalImages })
    const results: ImageClassificationResult[] = []
    const batchSize = config.batchSize || 10
    let completedCount = 0

    for (let i = 0; i < totalImages; i += batchSize) {
      if (classificationCancelled) break

      const batch = imagePaths.slice(i, i + batchSize)
      const batchPromises = batch.map(async (imagePath) => {
        let result: ImageClassificationResult
        try {
          const presetOrModel =
            config.presetId ?? config.modelId ?? 'accuracy_max'
          result = await classifyImage(imagePath, presetOrModel)
        } catch (error) {
          console.error('[Main] 分类失败:', imagePath, error)
          result = {
            filePath: imagePath,
            category: 'other' as ImageContentCategory,
            confidence: 0
          }
        }
        completedCount++
        sendProgress({
          status: 'classifying',
          current: completedCount,
          total: totalImages,
          currentFile: imagePath,
          latestResult: result
        })
        return result
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    const successCount = results.filter(r => r.confidence > 0).length
    const errorCount = totalImages - successCount
    
    sendProgress({
      status: 'completed',
      current: totalImages,
      total: totalImages,
      results
    })
    
    currentClassificationWindow = null
    return {
      results,
      totalImages,
      successCount,
      errorCount,
      classificationTime: Date.now() - startTime
    }
  } catch (error) {
    console.error('[Main] 批量分类失败:', error)
    sendProgress({ status: 'error', currentFile: `错误: ${error}` })
    currentClassificationWindow = null
    throw error
  }
})

// IPC 处理器：取消分类
ipcMain.on('image:cancelClassification', () => {
  classificationCancelled = true
  currentClassificationWindow = null
})

// IPC：编辑预览（降采样 base64）
ipcHandle('image:previewExport', async (_event, filePath: string, options: any): Promise<any> => {
  const imageUtils = await import('./utils/imageUtils')
  return imageUtils.previewExport(filePath, options)
})

ipcHandle('image:previewEdits', async (_event, filePath: string, settings: any): Promise<string> => {
  const imageUtils = await import('./utils/imageUtils')
  return imageUtils.previewEdits(filePath, settings)
})

ipcHandle('image:getHistogram', async (_event, filePath: string): Promise<any> => {
  const imageUtils = await import('./utils/imageUtils')
  const result = await imageUtils.getImageHistogram(filePath)
  return {
    bins: Array.from(result.bins),
    total: result.total,
    peak: result.peak,
    clipShadow: result.clipShadow,
    clipHighlight: result.clipHighlight,
    rgbBins: result.rgbBins
      ? {
          r: Array.from(result.rgbBins.r),
          g: Array.from(result.rgbBins.g),
          b: Array.from(result.rgbBins.b),
        }
      : undefined,
  }
})

// IPC：分析建议编辑参数
ipcHandle('image:analyzeForEdit', async (_event, filePath: string): Promise<any> => {
  const imageUtils = await import('./utils/imageUtils')
  return imageUtils.analyzeForEdit(filePath)
})

// IPC 处理器：应用编辑设置（可用于单图或批量）
ipcHandle('image:applyEdits', async (_event, paths: string[] | string, settings: any): Promise<BatchOperationResult[]> => {
  const filePaths = Array.isArray(paths) ? paths : [paths]
  const results: BatchOperationResult[] = []
  const imageUtils = await import('./utils/imageUtils')
  for (const p of filePaths) {
    try {
      console.log('[Main] applyEdits request for', p)
      const outPath = await imageUtils.applyEdits(p, settings)
      results.push({ filePath: p, success: true, newPath: outPath })
    } catch (err: any) {
      const msg = err?.message || ''
      console.error('[Main] applyEdits error for', p, msg)
      results.push({ filePath: p, success: false, error: msg })
    }
  }
  return results
})

// IPC 处理器：格式转换
ipcHandle('image:convertFormat', async (_event, paths: string[] | string, options: any, outputPath?: string): Promise<BatchOperationResult[]> => {
  const filePaths = Array.isArray(paths) ? paths : [paths]
  const results: BatchOperationResult[] = []
  for (const p of filePaths) {
    try {
      const newPath = await import('./utils/imageUtils').then(mod =>
        mod.convertFormat(p, options, outputPath)
      )
      results.push({ filePath: p, success: true, newPath })
    } catch (err: any) {
      results.push({ filePath: p, success: false, error: err.message })
    }
  }
  return results
})

// IPC 处理器：压缩图片
ipcHandle('image:compress', async (_event, paths: string[] | string, options: any): Promise<BatchOperationResult[]> => {
  const filePaths = Array.isArray(paths) ? paths : [paths]
  const results: BatchOperationResult[] = []
  for (const p of filePaths) {
    try {
      await import('./utils/imageUtils').then(mod => mod.compressImage(p, options))
      results.push({ filePath: p, success: true })
    } catch (err: any) {
      results.push({ filePath: p, success: false, error: err.message })
    }
  }
  return results
})

// IPC 处理器：预估压缩大小，仅返回单张结果
ipcHandle('image:estimateCompressedSize', async (_event, path: string, options: any): Promise<number> => {
  try {
    const size = await import('./utils/imageUtils').then(mod => mod.estimateCompressedSize(path, options))
    return size
  } catch (err) {
    console.error('[Main] 估算压缩大小失败:', err)
    return 0
  }
})

// ==================== 模型下载功能 ====================

let downloadCancelled = false

// IPC 处理器：获取可用模型列表
ipcHandle('model:getAvailableModels', async (): Promise<Array<{ id: string; name: string; description: string; sizeMB: number }>> => {
  return CLASSIFICATION_MODELS.map(({ downloadUrls, ...rest }) => rest)
})

// IPC 处理器：获取精准度预设列表
ipcHandle('model:getAvailablePresets', async () => {
  return CLASSIFICATION_PRESETS.map(rest => ({ ...rest }))
})

function checkSingleModelExists(cwd: string, modelId: ClassificationModelId): boolean {
  return existsSync(getClassificationModelPath(modelId, cwd))
}

function checkPresetModelsReady(cwd: string, presetId: ClassificationPresetId): boolean {
  const preset = getPresetById(presetId)
  const modelsDir = getModelsDir(cwd)
  const promptsPath = join(modelsDir, preset.promptsFile)
  if (!existsSync(promptsPath)) return false
  return getPresetRequiredModelIds(preset).every(id => checkSingleModelExists(cwd, id))
}

// IPC 处理器：检查指定模型或预设是否就绪
ipcHandle('model:checkExists', async (_event, modelOrPresetId?: string): Promise<boolean> => {
  const cwd = resolveProjectRoot()
  const id = modelOrPresetId ?? 'accuracy_max'

  if (isPresetDownloadId(id) || isPresetId(id)) {
    return checkPresetModelsReady(cwd, id as ClassificationPresetId)
  }

  const modelId = id as ClassificationModelId
  if (modelId === 'clip_vit_b32_quant') {
    return checkPresetModelsReady(cwd, 'accuracy_fast')
  }
  if (modelId === 'clip_vit_l14_quant') {
    return checkPresetModelsReady(cwd, 'accuracy_max')
  }
  return checkSingleModelExists(cwd, modelId)
})

/**
 * 文本嵌入必须随应用提供，不在运行时生成：
 * 真实 CLIP 文本编码器是开发期依赖（需联网下载模型），打包后的应用不具备该能力。
 * 旧实现会在缺失时 spawn bootstrap 脚本，而该脚本过去产出的是伪嵌入，会让分类静默变随机。
 */
function ensurePromptsFile(promptsFile: string): boolean {
  const root = resolveProjectRoot()
  const promptsPath = join(getModelsDir(root), promptsFile)
  if (existsSync(promptsPath)) return true
  console.error(
    `[Main] 缺少真实 CLIP 文本嵌入 ${promptsPath}；请在开发环境执行 npm run gen:clip-prompts ` +
    '生成后随应用一同部署，运行时不会自动生成。'
  )
  return false
}

async function downloadSingleModelInternal(
  modelId: ClassificationModelId,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; error?: string; cancelled?: boolean; downloadUrls?: string[] }> {
  downloadCancelled = false
  return downloadModelFile(modelId, {
    isCancelled: () => downloadCancelled,
    onProgress: p => onProgress?.(p.progress),
    onSaved: id => clearModelCache(id),
    sendIpcProgress: p => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('model:downloadProgress', p)
      }
    }
  })
}

async function downloadPresetBundle(
  presetId: ClassificationPresetId
): Promise<{ success: boolean; error?: string; cancelled?: boolean; downloadUrls?: string[] }> {
  const cwd = resolveProjectRoot()
  const preset = getPresetById(presetId)

  if (!ensurePromptsFile(preset.promptsFile)) {
    return {
      success: false,
      error: `缺少 ${preset.promptsFile}，请在项目根目录执行: npm run bootstrap:clip-prompts`,
      downloadUrls: []
    }
  }

  const required = getPresetRequiredModelIds(preset)
  const missing = required.filter(mid => !checkSingleModelExists(cwd, mid))
  if (missing.length === 0) {
    return { success: true }
  }

  console.log('[Main] 预设下载', presetId, '缺失模型:', missing.join(', '))

  for (let i = 0; i < missing.length; i++) {
    const modelId = missing[i]
    if (!getModelInfo(modelId)) {
      return {
        success: false,
        error: `预设 ${presetId} 包含无效模型引用: ${modelId}`,
        downloadUrls: []
      }
    }
    const result = await downloadSingleModelInternal(modelId, p => {
      const base = Math.round((i / missing.length) * 100)
      const slice = Math.round(p / missing.length)
      const combined = Math.min(99, base + slice)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('model:downloadProgress', {
          progress: combined,
          bytesDownloaded: 0,
          totalBytes: 0
        })
      }
    })
    if (!result.success) {
      return {
        ...result,
        error: result.error ? `下载 ${modelId} 失败: ${result.error}` : `下载 ${modelId} 失败`
      }
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('model:downloadProgress', {
      progress: 100,
      bytesDownloaded: 0,
      totalBytes: 0
    })
  }
  return { success: true }
}

// IPC 处理器：下载模型文件（支持 presetId，按序下载缺失模型）
ipcHandle('model:download', async (_event, modelOrPresetId?: unknown): Promise<{ success: boolean; error?: string; cancelled?: boolean; downloadUrls?: string[] }> => {
  try {
    const rawId = parseDownloadTargetId(modelOrPresetId)
    console.log('[Main] model:download 目标:', rawId, '根目录:', resolveProjectRoot(), '原始参数:', modelOrPresetId)

    if (isPresetDownloadId(rawId)) {
      return await downloadPresetBundle(rawId)
    }

    if (rawId === 'clip_vit_b32_quant' || rawId === 'clip_vit_l14_quant' || rawId === 'efficientnet_b4') {
      const presetId = legacyModelIdToPreset(rawId)
      console.log('[Main] 旧版模型选项映射为预设下载:', rawId, '->', presetId)
      return await downloadPresetBundle(presetId)
    }

    const cwd = resolveProjectRoot()
    let modelId = rawId as ClassificationModelId

    if (!getModelInfo(modelId)) {
      return {
        success: false,
        error: `未知的下载目标「${rawId}」。请在上方选择「轻量 / 平衡 / 最高」精准度；进阶区请选 MobileNet / EfficientNet 等具体模型。`,
        downloadUrls: []
      }
    }

    if (modelId === 'clip_vit_b32_quant' && !existsSync(getClassificationModelPath('mobilenetv2', cwd))) {
      modelId = 'mobilenetv2'
    }
    return await downloadSingleModelInternal(modelId)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Main] model:download 未捕获异常:', error)
    return { success: false, error: msg || '下载过程发生未知错误', downloadUrls: [] }
  }
})

// IPC 处理器：取消下载
ipcMain.on('model:cancelDownload', () => {
  downloadCancelled = true
  console.log('[Main] 取消下载请求已发送')
})

// IPC 处理器：选择并保存模型文件
ipcHandle('model:selectAndSave', async (): Promise<string | null> => {
  const { dialog } = await import('electron')

  console.log('[Main] 打开文件选择器...')

  try {
    const win = mainWindow
    const result = await (dialog.showOpenDialog as any)(win, {
      title: '选择模型文件',
      filters: [
        { name: 'ONNX Model', extensions: ['onnx'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    console.log('[Main] 文件选择结果:', result)

    if (!result.canceled && result.filePaths.length > 0) {
      const savedPath = await saveModelFile(result.filePaths[0])
      console.log('[Main] 保存结果:', savedPath)
      return savedPath
    }
  } catch (error) {
    console.error('[Main] 选择文件失败:', error)
  }

  return null
})

// IPC 处理器：保存模型文件
ipcHandle('model:saveFile', async (_event, sourcePath: string): Promise<string | null> => {
  try {
    const filename = sourcePath.split(/[/\\]/).pop()
    if (!filename) return null
    
    const resolvedId = modelIdFromOnnxBasename(filename)
    const modelId = resolvedId || (filename.replace('.onnx', '').toLowerCase() as ClassificationModelId)
    const modelFileName = MODEL_FILE_NAMES[modelId] || filename
    const root = resolveProjectRoot()
    const targetPath = getClassificationModelPath(modelId, root)

    ensureModelsDir(root)

    fs.copyFileSync(sourcePath, targetPath)
    clearModelCache(modelId)
    console.log('[Main] 模型文件已保存:', targetPath)
    return targetPath
  } catch (error) {
    console.error('[Main] 保存模型文件失败:', error)
    return null
  }
})

// 辅助函数：保存模型文件
async function saveModelFile(sourcePath: string): Promise<string | null> {
  console.log('[Main] saveModelFile 被调用，源路径:', sourcePath)
  
  if (!sourcePath) {
    console.error('[Main] 源路径为空')
    return null
  }

  if (!existsSync(sourcePath)) {
    console.error('[Main] 源文件不存在:', sourcePath)
    return null
  }

  const filename = sourcePath.split(/[/\\]/).pop() || ''
  const resolvedId = modelIdFromOnnxBasename(filename)
  const modelId = resolvedId || (filename.replace('.onnx', '').toLowerCase() as ClassificationModelId)
  const modelFileName = MODEL_FILE_NAMES[modelId] || filename
  
  const root = resolveProjectRoot()
  const targetDir = getModelsDir(root)
  const targetPath = join(targetDir, modelFileName)

  console.log('[Main] 目标路径:', targetPath)

  try {
    ensureModelsDir(root)

    if (existsSync(targetPath)) {
      console.log('[Main] 删除旧文件')
      fs.unlinkSync(targetPath)
    }

    console.log('[Main] 开始复制文件...')
    fs.copyFileSync(sourcePath, targetPath)
    console.log('[Main] 文件复制成功:', targetPath)
    
    clearModelCache(modelId)
    return targetPath
  } catch (error: any) {
    console.error('[Main] 保存模型文件失败:', error)
    return null
  }
}

// ==================== 实用工具功能 ====================

// IPC 处理器：批量重命名
ipcHandle('tools:batchRename', async (_event, files: string[], options: any): Promise<any[]> => {
  try {
    const { batchRename } = await import('./services/imageToolService')
    return await batchRename(files, options)
  } catch (error) {
    console.error('[Main] 批量重命名失败:', error)
    return files.map(f => ({ originalPath: f, newPath: '', success: false, error: (error as Error).message }))
  }
})

// IPC 处理器：添加水印
ipcHandle('tools:addWatermark', async (_event, files: string[], options: any): Promise<any[]> => {
  try {
    const { addWatermark } = await import('./services/imageToolService')
    return await addWatermark(files, options)
  } catch (error) {
    console.error('[Main] 添加水印失败:', error)
    return files.map(f => ({ filePath: f, success: false, error: (error as Error).message }))
  }
})

// IPC 处理器：水印预览
ipcHandle('tools:previewWatermark', async (_event, filePath: string, options: any): Promise<string> => {
  try {
    const { previewWatermark } = await import('./services/imageToolService')
    return await previewWatermark(filePath, options)
  } catch (error) {
    console.error('[Main] 水印预览失败:', error)
    throw error
  }
})

// IPC 处理器：图片拼接
ipcHandle('tools:stitchImages', async (_event, images: string[], options: any): Promise<string> => {
  try {
    const { stitchImages } = await import('./services/imageToolService')
    return await stitchImages(images, options)
  } catch (error) {
    console.error('[Main] 图片拼接失败:', error)
    throw error
  }
})

// IPC 处理器：GIF制作
ipcHandle('tools:createGif', async (_event, frames: any[], options: any): Promise<string> => {
  try {
    const { createGif } = await import('./services/imageToolService')
    return await createGif(frames, options)
  } catch (error) {
    console.error('[Main] GIF制作失败:', error)
    throw error
  }
})

// IPC 处理器：图片转PDF
ipcHandle('tools:imagesToPdf', async (_event, images: string[], options: any): Promise<string> => {
  try {
    const { imagesToPdf } = await import('./services/imageToolService')
    return await imagesToPdf(images, options)
  } catch (error) {
    console.error('[Main] 图片转PDF失败:', error)
    throw error
  }
})

// IPC 处理器：生成缩略图
ipcHandle('tools:generateThumbnails', async (_event, files: string[], options: any): Promise<any[]> => {
  try {
    const { generateThumbnails } = await import('./services/imageToolService')
    return await generateThumbnails(files, options)
  } catch (error) {
    console.error('[Main] 生成缩略图失败:', error)
    return files.map(f => ({ originalPath: f, thumbnailPath: '', success: false, error: (error as Error).message }))
  }
})

// IPC 处理器：图片增强
ipcHandle('tools:enhanceImage', async (_event, file: string, options: any): Promise<string> => {
  try {
    const { enhanceImage } = await import('./services/imageToolService')
    return await enhanceImage(file, options)
  } catch (error) {
    console.error('[Main] 图片增强失败:', error)
    throw error
  }
})

ipcHandle(
  'tools:previewFocusAdjust',
  async (_event, filePath: string, options: import('../../src/types').FocusAdjustOptions): Promise<string> => {
    try {
      const { previewFocusAdjust } = await import('./utils/focusAdjustProcessor')
      return await previewFocusAdjust(filePath, options)
    } catch (error) {
      console.error('[Main] 对焦调整预览失败:', error)
      throw error
    }
  }
)

ipcHandle(
  'tools:applyFocusAdjust',
  async (_event, filePath: string, options: import('../../src/types').FocusAdjustOptions): Promise<string> => {
    try {
      const { applyFocusAdjust } = await import('./utils/focusAdjustProcessor')
      return await applyFocusAdjust(filePath, options)
    } catch (error) {
      console.error('[Main] 对焦调整导出失败:', error)
      throw error
    }
  }
)

// IPC 处理器：图片格式转换
ipcHandle('tools:convertImageFormat', async (_event, images: string[], options: any, outputPath: string): Promise<any> => {
  try {
    const { convertImageFormat } = await import('./services/imageToolService')
    return await convertImageFormat(images, options, outputPath)
  } catch (error) {
    console.error('[Main] 图片格式转换失败:', error)
    throw error
  }
})

// IPC 处理器：选择文件
ipcHandle('dialog:selectFiles', async (_event, filter?: string): Promise<string[] | null> => {
  try {
    const win = mainWindow
    const result = await (dialog.showOpenDialog as any)(win, {
      title: '选择文件',
      filters: [
        { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths
    }
  } catch (error) {
    console.error('[Main] 选择文件失败:', error)
  }
  return null
})

