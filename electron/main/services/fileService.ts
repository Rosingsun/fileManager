import { join } from 'path'
import fs from 'fs-extra'

const { readdir, stat, mkdir, move, existsSync } = fs

export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedTime: number
  createdTime: number
}

export interface OrganizeConfig {
  sourcePath: string
  rules: {
    type: 'extension' | 'date' | 'size' | 'custom'
    dateFormat?: 'year' | 'month' | 'day'
    pattern?: string
  }
  options: {
    includeSubdirectories: boolean
    conflictAction: 'skip' | 'overwrite' | 'rename'
  }
}

export async function readDirectory(path: string): Promise<FileInfo[]> {
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

  return fileInfos.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

export async function readDirectoryRecursive(dirPath: string): Promise<FileInfo[]> {
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

export async function organizeFiles(config: OrganizeConfig): Promise<Array<{ from: string; to: string; success: boolean; error?: string }>> {
  const { sourcePath, rules, options } = config
  const results: Array<{ from: string; to: string; success: boolean; error?: string }> = []

  const items = await readdir(sourcePath)
  
  for (const item of items) {
    const sourceFile = join(sourcePath, item)
    const stats = await stat(sourceFile)
    
    if (stats.isDirectory() && !options.includeSubdirectories) {
      continue
    }

    if (stats.isDirectory()) {
      continue
    }

    let targetDir = sourcePath
    
    if (rules.type === 'extension') {
      const ext = item.split('.').pop()?.toLowerCase() || 'other'
      targetDir = join(sourcePath, ext)
    } else if (rules.type === 'date') {
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
      const sizeMB = stats.size / (1024 * 1024)
      let sizeCategory = 'small'
      if (sizeMB > 100) sizeCategory = 'large'
      else if (sizeMB > 10) sizeCategory = 'medium'
      targetDir = join(sourcePath, sizeCategory)
    } else if (rules.type === 'custom' && rules.pattern) {
      const match = item.match(new RegExp(rules.pattern))
      if (match && match[1]) {
        targetDir = join(sourcePath, match[1])
      }
    }

    await mkdir(targetDir, { recursive: true })
    
    const targetFile = join(targetDir, item)
    
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
}

export async function extractFiles(
  targetPath: string,
  extensions: string[],
  conflictAction: 'skip' | 'overwrite' | 'rename'
): Promise<Array<{ from: string; to: string; success: boolean; error?: string }>> {
  if (!existsSync(targetPath)) {
    throw new Error('目标目录不存在')
  }

  const results: Array<{ from: string; to: string; success: boolean; error?: string }> = []
  
  const allFiles = await getAllFiles(targetPath, extensions)
  
  const filesToExtract = allFiles.filter(file => {
    const fileDir = file.path.substring(0, file.path.lastIndexOf(file.name) - 1)
    return fileDir !== targetPath
  })

  for (const file of filesToExtract) {
    const targetFile = join(targetPath, file.name)
    
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
}

async function getAllFiles(dirPath: string, extensions: string[]): Promise<Array<{ path: string; name: string }>> {
  const files: Array<{ path: string; name: string }> = []
  
  async function traverse(currentPath: string) {
    try {
      const items = await readdir(currentPath)
      
      for (const item of items) {
        const fullPath = join(currentPath, item)
        const stats = await stat(fullPath)
        
        if (stats.isDirectory()) {
          await traverse(fullPath)
        } else {
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
