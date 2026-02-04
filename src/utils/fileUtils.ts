import type { FileInfo } from '../types'

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 格式化日期时间
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
}

/**
 * 根据扩展名获取文件类型图标
 */
export function getFileTypeIcon(extension: string, isDirectory: boolean): string {
  if (isDirectory) return 'folder'
  
  const iconMap: Record<string, string> = {
    // 图片
    'jpg': 'image',
    'jpeg': 'image',
    'png': 'image',
    'gif': 'image',
    'bmp': 'image',
    'svg': 'image',
    'webp': 'image',
    // 文档
    'pdf': 'file-pdf',
    'doc': 'file-word',
    'docx': 'file-word',
    'xls': 'file-excel',
    'xlsx': 'file-excel',
    'ppt': 'file-ppt',
    'pptx': 'file-ppt',
    'txt': 'file-text',
    'md': 'file-text',
    // 视频
    'mp4': 'video',
    'avi': 'video',
    'mov': 'video',
    'wmv': 'video',
    'flv': 'video',
    'mkv': 'video',
    // 音频
    'mp3': 'audio',
    'wav': 'audio',
    'flac': 'audio',
    'aac': 'audio',
    // 压缩文件
    'zip': 'file-zip',
    'rar': 'file-zip',
    '7z': 'file-zip',
    'tar': 'file-zip',
    'gz': 'file-zip'
  }
  
  return iconMap[extension] || 'file'
}

/**
 * 排序文件列表
 */
export function sortFileList(files: FileInfo[], sortBy: 'name' | 'size' | 'date' = 'name'): FileInfo[] {
  const sorted = [...files]
  
  sorted.sort((a, b) => {
    // 文件夹始终在前
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name, 'zh-CN')
      case 'size':
        return b.size - a.size
      case 'date':
        return b.modifiedTime - a.modifiedTime
      default:
        return 0
    }
  })
  
  return sorted
}

/**
 * 根据扩展名获取文件分类
 */
export function getFileCategory(extension: string): 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other' {
  const ext = extension.toLowerCase()

  const categoryExtensions: Record<string, string[]> = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'raw', 'heic', 'psd'],
    video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', '3gp', 'rmvb'],
    audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'ape', 'aiff'],
    document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg']
  }

  for (const [category, extensions] of Object.entries(categoryExtensions)) {
    if (extensions.includes(ext)) {
      return category as 'image' | 'video' | 'audio' | 'document' | 'archive'
    }
  }

  return 'other'
}

/**
 * 筛选文件列表
 */
export function filterFiles(
  files: FileInfo[],
  category: 'all' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other',
  subExtensions: string[] = []
): FileInfo[] {
  if (category === 'all') {
    return files
  }

  return files.filter(file => {
    if (file.isDirectory) return false

    const ext = getFileExtension(file.name)
    const fileCategory = getFileCategory(ext)

    if (fileCategory !== category) return false

    if (subExtensions.length > 0) {
      return subExtensions.includes(ext.toLowerCase())
    }

    return true
  })
}

