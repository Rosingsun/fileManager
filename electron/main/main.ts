import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { basename, dirname, join, parse } from 'path'
import { mkdirSync } from 'fs'
import fs from 'fs-extra'
import { watch } from 'chokidar'
import sharp from 'sharp'
import crypto from 'crypto'
import type { OrganizeConfig, FileInfo, SimilarityScanConfig, ImageHash, SimilarityGroup, SimilarityScanProgress, SimilarityScanResult, ImageContentCategory, ImageClassificationResult, ImageClassificationConfig, ImageClassificationProgress, ImageClassificationBatchResult, ImageQualityScanConfig, ImageQualityScanResult, ImageQualityScanProgress, BatchFileOpResult, BatchRelocateEntry, FileConflictAction } from '../../src/types'
import { scanImageQuality, computePhotoQualityTierForImage } from './services/imageQualityService'
import type { ClassificationModelId } from './utils/classificationModels'
export type { ClassificationModelId } from './utils/classificationModels'
import { CLASSIFICATION_MODELS, getClassificationModelPath, MODEL_FILE_NAMES, modelIdFromOnnxBasename } from './utils/classificationModels'
import { classifyImage as runClassifyImage, clearImagenetSessionCache } from './services/imageClassificationService'
import { clearClipModelCache } from './utils/clipClassifier'
import { clearCognivisionMobilenetCache } from './services/cognivisionTfClassifier'
import { readShutterCountFromFile, shutdownExiftool } from './utils/shutterCount'


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

  mainWindow.on('closed', () => {
    mainWindow = undefined
    if (fileWatcher) {
      fileWatcher.close()
      fileWatcher = null
    }
  })
}

app.whenReady().then(() => {
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

// IPC 处理器：读取目录内容
ipcHandle('fs:readDirectory', async (_event, path: string): Promise<FileInfo[]> => {
  try {
    if (!existsSync(path)) {
      return []
    }

    const items = await readdir(path)
    const fileInfos: FileInfo[] = []

    for (const item of items) {
      const fullPath = join(path, item)
      const stats = await stat(fullPath)
      
      fileInfos.push({
        name: item,
        path: fullPath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modifiedTime: stats.mtime.getTime(),
        createdTime: stats.birthtime.getTime()
      })
    }

    // 排序：文件夹在前，然后按名称排序
    return fileInfos.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error('读取目录失败:', error)
    throw error
  }
})

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

ipcHandle('file:getImageBase64', async (_event, filePath: string): Promise<string> => {
  try {
    const buffer = await fs.readFile(filePath)
    const mimeType = getMimeType(filePath)
    const base64 = buffer.toString('base64')
    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error('[Main] 获取图片base64失败:', error)
    return ''
  }
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
  try {
    const metadata = await sharp(filePath).metadata()
    if (metadata.width && metadata.height) {
      return {
        width: metadata.width,
        height: metadata.height
      }
    }
    return null
  } catch (error) {
    console.error('[Main] 获取图片尺寸失败:', error)
    return null
  }
})

// IPC 处理器：获取图片缩略图base64用于预览（使用sharp，动态质量压缩）
ipcHandle('file:getImageThumbnail', async (_event, filePath: string, size: number = 100, quality: number = 60): Promise<string> => {
  try {
    // 获取文件大小，确保只处理50MB及以下的图片（包括50MB）
    const stats = await stat(filePath)
    const MAX_THUMBNAIL_SIZE = 50 * 1024 * 1024 // 50MB
    
    // 只有超过50MB的图片才跳过，小于等于50MB的都应该处理
    if (stats.size > MAX_THUMBNAIL_SIZE) {
      console.warn(`[Main] 跳过大于50MB的图片缩略图生成: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`)
      return ''
    }
    
    const mimeType = getMimeType(filePath)
    const isPng = mimeType === 'image/png'||mimeType === 'image/jpeg'||mimeType === 'image/jpg'
    const isWebp = mimeType === 'image/webp'
    const isGif = mimeType === 'image/gif'
    const isBmp = mimeType === 'image/bmp'
    const isSvg = mimeType === 'image/svg+xml'
    
    // 根据传入的quality参数动态调整质量，默认60（中等质量）
    // 提供更好的视觉效果，特别是在相似度检测页面
    const effectiveQuality = Math.max(Math.min(quality || 60, 100), 1)
    const sharpInstance = sharp(filePath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
    
    let buffer: Buffer
    
    // 针对不同图片格式进行优化处理，使用动态质量
    if (isPng) {
      // PNG格式转换为JPEG以减小体积（PNG不支持质量参数，转换为JPEG）
      buffer = await sharpInstance.jpeg({
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    } else if (isWebp) {
      // WebP格式使用动态质量
      buffer = await sharpInstance.webp({
        quality: effectiveQuality,
        lossless: effectiveQuality === 100
      }).toBuffer()
    } else if (isGif) {
      // 对于GIF，使用Sharp生成静态缩略图（保留第一帧），使用动态质量
      buffer = await sharpInstance.jpeg({ 
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    } else if (isBmp) {
      // BMP格式转换为JPEG以减小体积，使用动态质量
      buffer = await sharpInstance.jpeg({ 
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    } else if (isSvg) {
      // SVG格式转换为JPEG以减小体积，使用动态质量
      buffer = await sharpInstance.jpeg({ 
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    } else {
      // 默认使用JPEG，适用于JPEG等格式，使用动态质量
      buffer = await sharpInstance.jpeg({
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    }
    
    const base64 = buffer.toString('base64')
    // 统一输出为JPEG格式以减小体积
    return `data:image/jpeg;base64,${base64}`
  } catch (error) {
    console.error('[Main] 生成图片缩略图失败:', error)
    // 优化回退方法：尝试使用更低质量或更小尺寸
    try {
      // 检查文件大小，确保只处理50MB及以下的图片
      const stats = await stat(filePath)
      const MAX_THUMBNAIL_SIZE = 50 * 1024 * 1024 // 50MB
      
      // 只有超过50MB的图片才跳过，小于等于50MB的都应该尝试处理
      if (stats.size > MAX_THUMBNAIL_SIZE) {
        console.warn(`[Main] 回退方法：跳过大于50MB的图片: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`)
        return ''
      }
      
      // 尝试使用最低质量和更小尺寸重新生成
      const sharpInstance = sharp(filePath)
        .resize(50, 50, { // 使用更小的尺寸
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ 
          quality: 1, // 使用最低质量
          progressive: false,
          chromaSubsampling: '4:2:0'
        })
      
      const buffer = await sharpInstance.toBuffer()
      const base64 = buffer.toString('base64')
      return `data:image/jpeg;base64,${base64}`
    } catch (fallbackError) {
      console.error('[Main] 回退方法也失败:', fallbackError)
      return ''
    }
  }
})

// ==================== 相似照片检测功能 ====================

// 支持的图片格式
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif', 'tiff', 'tif']

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
  clearCognivisionMobilenetCache()
}

async function classifyImage(
  imagePath: string,
  modelId: ClassificationModelId = 'clip_vit_b32_quant'
): Promise<ImageClassificationResult> {
  const base = await runClassifyImage(imagePath, process.cwd(), modelId)
  try {
    const quality = await computePhotoQualityTierForImage(imagePath)
    return { ...base, quality }
  } catch (e) {
    console.warn('[Main] 照片质量档位计算失败:', imagePath, e)
    return { ...base, quality: 'low' }
  }
}

ipcHandle('image:classify', async (_event, imagePath: string): Promise<ImageClassificationResult> => {
  return await classifyImage(imagePath)
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
    
    for (let i = 0; i < totalImages; i += batchSize) {
      if (classificationCancelled) break
      
      const batch = imagePaths.slice(i, i + batchSize)
      const batchPromises = batch.map(async (imagePath) => {
        try {
          sendProgress({
            status: 'classifying',
            current: i + batch.indexOf(imagePath) + 1,
            total: totalImages,
            currentFile: imagePath
          })
          const modelId = (config.modelId as ClassificationModelId) || 'clip_vit_b32_quant'
          return await classifyImage(imagePath, modelId)
        } catch (error) {
          console.error('[Main] 分类失败:', imagePath, error)
          return {
            filePath: imagePath,
            category: 'other' as ImageContentCategory,
            confidence: 0
          }
        }
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

// IPC 处理器：应用编辑设置（可用于单图或批量）
ipcHandle('image:applyEdits', async (_event, paths: string[] | string, settings: any): Promise<BatchOperationResult[]> => {
  const filePaths = Array.isArray(paths) ? paths : [paths]
  const results: BatchOperationResult[] = []
  for (const p of filePaths) {
    try {
      console.log('[Main] applyEdits request for', p)
      await import('./utils/imageUtils').then(mod => mod.applyEdits(p, settings))
      results.push({ filePath: p, success: true })
    } catch (err: any) {
      const msg = err?.message || ''
      console.error('[Main] applyEdits error for', p, msg)
      // 如果是 sharp 抛出的同路径错误，尝试备用写入逻辑
      if (msg.includes('same file')) {
        try {
          console.log('[Main] applyEdits fallback for', p)
          const tempPath = `${p}.tmp`
          await import('./utils/imageUtils').then(mod => mod.applyEdits(p, settings, tempPath))
          const fsExtra = await import('fs-extra')
          await fsExtra.move(tempPath, p, { overwrite: true })
          results.push({ filePath: p, success: true })
          continue
        } catch (e: any) {
          console.error('[Main] fallback applyEdits failed for', p, e?.message)
          results.push({ filePath: p, success: false, error: e?.message })
          continue
        }
      }
      // 权限或占用导致无法覆盖原文件时, 改为写入新文件并告知前端路径
      if (msg.includes('权限不足') || msg.includes('文件被占用') || err.code === 'EPERM' || err.code === 'EACCES') {
        try {
          const path = await import('path')
          const fsExtra = await import('fs-extra')
          const ext = path.extname(p)
          const base = path.basename(p, ext)
          const dir = path.dirname(p)
          const newPath = path.join(dir, `${base}-edited${ext}`)
          console.log('[Main] EPERM fallback writing to new file', newPath)
          await import('./utils/imageUtils').then(mod => mod.applyEdits(p, settings, newPath))
          results.push({ filePath: p, success: true, newPath })
          continue
        } catch (e: any) {
          console.error('[Main] EPERM fallback new path failed for', p, e?.message)
          // fall through to error push below
        }
      }
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
      await import('./utils/imageUtils').then(mod => mod.convertFormat(p, options, outputPath))
      results.push({ filePath: p, success: true })
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

// 获取模型信息
function getModelInfo(modelId: ClassificationModelId) {
  return CLASSIFICATION_MODELS.find(m => m.id === modelId)
}

// IPC 处理器：获取可用模型列表
ipcHandle('model:getAvailableModels', async (): Promise<Array<{ id: string; name: string; description: string; sizeMB: number }>> => {
  return CLASSIFICATION_MODELS.map(({ downloadUrls, ...rest }) => rest)
})

// IPC 处理器：检查指定模型文件是否存在
ipcHandle('model:checkExists', async (_event, modelId?: string): Promise<boolean> => {
  const id: ClassificationModelId = (modelId as ClassificationModelId) || 'clip_vit_b32_quant'
  const cwd = process.cwd()
  // CLIP 方案依赖 MobileNet 做 ImageNet 聚合；CLIP 视觉 ONNX 与 prompts 为可选增强
  if (id === 'clip_vit_b32_quant') {
    const mnPath = getClassificationModelPath(cwd, 'mobilenetv2')
    return existsSync(mnPath)
  }
  if (id === 'cognivision') {
    return existsSync(join(cwd, 'models', 'imagenet1000.json'))
  }
  const modelPath = getClassificationModelPath(cwd, id)
  return existsSync(modelPath)
})

// IPC 处理器：下载模型文件
ipcHandle('model:download', async (_event, modelId?: string): Promise<{ success: boolean; error?: string; cancelled?: boolean; downloadUrls?: string[] }> => {
  let id: ClassificationModelId = (modelId as ClassificationModelId) || 'clip_vit_b32_quant'
  // 选择 CLIP 方案时先拉取 MobileNet（分类必需），CLIP 视觉 ONNX 可单独再下
  if (id === 'clip_vit_b32_quant' && !existsSync(getClassificationModelPath(process.cwd(), 'mobilenetv2'))) {
    id = 'mobilenetv2'
  }
  const modelInfo = getModelInfo(id)

  if (!modelInfo) {
    return { success: false, error: '未知的模型 ID', downloadUrls: [] }
  }

  if (id === 'cognivision') {
    return { success: true }
  }

  const https = await import('https')
  const http = await import('http')
  const nodeFs = await import('fs')

  const modelUrls = modelInfo.downloadUrls
  
  const modelFileName = MODEL_FILE_NAMES[id] || `${id}.onnx`
  const modelPath = join(process.cwd(), 'models', modelFileName)
  const tempPath = join(process.cwd(), 'models', `${modelFileName}.tmp`)

  downloadCancelled = false

  const modelsDir = join(process.cwd(), 'models')
  if (!existsSync(modelsDir)) {
    mkdirSync(modelsDir, { recursive: true })
  }

  if (existsSync(tempPath)) {
    nodeFs.unlinkSync(tempPath)
  }

  return new Promise((resolve) => {
    const tryDownload = (urlIndex: number): void => {
      if (downloadCancelled) {
        resolve({ success: false, cancelled: true })
        return
      }

      if (urlIndex >= modelUrls.length) {
        console.error('[Main] 所有下载 URL 均失败')
        resolve({ success: false, error: '无法找到模型文件，请手动下载', downloadUrls: [...modelUrls] })
        return
      }

      const modelUrl = modelUrls[urlIndex]
      console.log(`[Main] 尝试下载 (${urlIndex + 1}/${modelUrls.length}): ${modelUrl}`)

      const protocol = modelUrl.startsWith('https') ? https : http

      const handleRedirectResponse = (response: any) => {
        if (response.statusCode !== 200) {
          if (response.statusCode === 404) {
            console.log('[Main] URL 不可用，尝试下一个:', modelUrl)
            tryDownload(urlIndex + 1)
            return
          }
          console.error('[Main] 下载失败，HTTP 状态码:', response.statusCode)
          resolve({ success: false, error: `HTTP ${response.statusCode}` })
          return
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
        console.log('[Main] 模型文件大小:', (totalBytes / 1024 / 1024).toFixed(2), 'MB')

        const fileStream = nodeFs.createWriteStream(tempPath)
        let downloadedBytes = 0

        response.on('data', (chunk: Buffer) => {
          if (downloadCancelled) {
            fileStream.destroy()
            response.destroy()
            return
          }

          downloadedBytes += chunk.length

          if (totalBytes > 0) {
            const progress = Math.round((downloadedBytes / totalBytes) * 100)

            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('model:downloadProgress', {
                progress,
                bytesDownloaded: downloadedBytes,
                totalBytes
              })
            }
          }
        })

        response.on('end', () => {
          if (downloadCancelled) {
            if (existsSync(tempPath)) {
              nodeFs.unlinkSync(tempPath)
            }
            resolve({ success: false, cancelled: true })
            return
          }

          fileStream.close()

          try {
            nodeFs.renameSync(tempPath, modelPath)
            clearModelCache(id)
            console.log('[Main] 模型下载完成:', modelPath, `(${modelInfo.name})`)
            resolve({ success: true })
          } catch (error: any) {
            console.error('[Main] 重命名文件失败:', error)
            if (existsSync(tempPath)) {
              nodeFs.unlinkSync(tempPath)
            }
            resolve({ success: false, error: error.message })
          }
        })

        response.on('error', (error: any) => {
          console.error('[Main] 下载流错误:', error)
          fileStream.destroy()
          if (existsSync(tempPath)) {
            nodeFs.unlinkSync(tempPath)
          }
          resolve({ success: false, error: error.message })
        })

        fileStream.on('error', (error: any) => {
          console.error('[Main] 写入文件错误:', error)
          if (existsSync(tempPath)) {
            nodeFs.unlinkSync(tempPath)
          }
          resolve({ success: false, error: error.message })
        })
      }

      const request = protocol.get(modelUrl, (response: any) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            console.log('[Main] 重定向到:', redirectUrl)
            const redirectProtocol = redirectUrl.startsWith('https') ? https : http
            redirectProtocol.get(redirectUrl, handleRedirectResponse)
            return
          }
        }

        handleRedirectResponse(response)
      })

      request.on('error', (error: any) => {
        console.error('[Main] 下载请求失败:', error)
        tryDownload(urlIndex + 1)
      })

      request.setTimeout(30000, () => {
        console.error('[Main] 下载请求超时，尝试下一个 URL')
        request.destroy()
        tryDownload(urlIndex + 1)
      })
    }

    console.log('[Main] 开始下载模型...')
    tryDownload(0)
  })
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
    const targetPath = join(process.cwd(), 'models', modelFileName)

    const modelsDir = join(process.cwd(), 'models')
    if (!existsSync(modelsDir)) {
      mkdirSync(modelsDir, { recursive: true })
    }

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
  
  const targetDir = join(process.cwd(), 'models')
  const targetPath = join(targetDir, modelFileName)

  console.log('[Main] 目标路径:', targetPath)

  try {
    if (!existsSync(targetDir)) {
      console.log('[Main] 创建目录:', targetDir)
      mkdirSync(targetDir, { recursive: true })
    }

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

