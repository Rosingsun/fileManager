import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import fs from 'fs-extra'
import { watch } from 'chokidar'
import type { OrganizeConfig, FileInfo } from '../../src/types'

const { readdir, stat, mkdir, move, existsSync } = fs

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

let mainWindow: BrowserWindow | null = null
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
    console.log('[Main] 页面加载完成')
    // 检查 electronAPI 是否已注入
    mainWindow?.webContents.executeJavaScript('window.electronAPI ? "已注入" : "未注入"')
      .then((result) => {
        console.log('[Main] electronAPI 状态:', result)
      })
      .catch((error) => {
        console.error('[Main] 检查 electronAPI 状态失败:', error)
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
    mainWindow = null
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

