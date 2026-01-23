import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import fs from 'fs-extra'
import { watch } from 'chokidar'
import sharp from 'sharp'
import crypto from 'crypto'
import type { OrganizeConfig, FileInfo, SimilarityScanConfig, ImageHash, SimilarityGroup, SimilarityScanProgress, SimilarityScanResult } from '../../src/types'

const { readdir, stat, mkdir, move, existsSync } = fs

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

// IPC 处理器：打开文件
ipcMain.handle('file:open', async (_event, filePath: string): Promise<boolean> => {
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
ipcMain.handle('dialog:openDirectory', async () => {
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

// IPC 处理器：读取目录内容
ipcMain.handle('fs:readDirectory', async (_event, path: string): Promise<FileInfo[]> => {
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
ipcMain.handle('fs:readDirectoryRecursive', async (_event, path: string): Promise<FileInfo[]> => {
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
ipcMain.handle('fs:extractFiles', async (_event, targetPath: string, extensions: string[], conflictAction: 'skip' | 'overwrite' | 'rename') => {
  try {
    if (!existsSync(targetPath)) {
      throw new Error('目标目录不存在')
    }

    const results: Array<{ from: string; to: string; success: boolean; error?: string }> = []
    
    // 获取所有匹配的文件（不包括目标目录本身的文件）
    const allFiles = await getAllFiles(targetPath, extensions)
    
    // 过滤掉已经在目标目录中的文件
    const filesToExtract = allFiles.filter(file => {
      const fileDir = file.path.substring(0, file.path.lastIndexOf(file.name) - 1)
      return fileDir !== targetPath
    })

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
ipcMain.handle('fs:organize', async (_event, config: OrganizeConfig) => {
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
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

// IPC 处理器：获取平台信息
ipcMain.handle('app:getPlatform', () => {
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
ipcMain.handle('file:rename', async (_event, oldPath: string, newName: string): Promise<boolean> => {
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
ipcMain.handle('file:delete', async (_event, filePath: string): Promise<boolean> => {
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

// IPC 处理器：获取图片base64用于预览
ipcMain.handle('file:getImageBase64', async (_event, filePath: string): Promise<string> => {
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

// IPC 处理器：获取图片尺寸信息
ipcMain.handle('file:getImageDimensions', async (_event, filePath: string): Promise<{ width: number; height: number } | null> => {
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

// IPC 处理器：获取图片缩略图base64用于预览
ipcMain.handle('file:getImageThumbnail', async (_event, filePath: string, size: number = 100, quality: number = 80): Promise<string> => {
  try {
    // 使用Sharp生成缩略图
    const buffer = await sharp(filePath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality }) // 统一转换为JPEG格式
      .toBuffer()
    
    const base64 = buffer.toString('base64')
    return `data:image/jpeg;base64,${base64}`
  } catch (error) {
    console.error('[Main] 生成图片缩略图失败:', error)
    // 回退到原方法
    try {
      const buffer = await fs.readFile(filePath)
      const mimeType = getMimeType(filePath)
      const base64 = buffer.toString('base64')
      return `data:${mimeType};base64,${base64}`
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

ipcMain.handle('similarity:scan', async (event, config: SimilarityScanConfig): Promise<SimilarityScanResult> => {
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

