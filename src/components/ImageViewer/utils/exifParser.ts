/**
 * EXIF数据解析工具
 * 注意：浏览器环境下无法直接读取EXIF，需要后端支持或使用exif-js库
 */

import type { ExifData } from '../types'

/**
 * 从图片元数据中提取EXIF信息
 * 这是一个简化版本，实际项目中可能需要使用exif-js或从后端获取
 */
export function parseExifFromImage(image: HTMLImageElement): ExifData | null {
  // 浏览器环境下无法直接读取EXIF数据
  // 需要后端支持或使用exif-js库
  // 这里返回null，实际实现需要根据项目情况调整
  return null
}

/**
 * 格式化EXIF数据（用于显示）
 */
export function formatExifData(exif: ExifData | null | undefined): Record<string, string> {
  if (!exif) return {}
  
  const formatted: Record<string, string> = {}
  
  if (exif.make || exif.model) {
    formatted['相机'] = [exif.make, exif.model].filter(Boolean).join(' ')
  }
  
  if (exif.dateTimeOriginal) {
    formatted['拍摄时间'] = formatDateTime(exif.dateTimeOriginal)
  }
  
  if (exif.fNumber) {
    formatted['光圈'] = `f/${exif.fNumber}`
  }
  
  if (exif.exposureTime) {
    formatted['快门速度'] = formatExposureTime(exif.exposureTime)
  }
  
  if (exif.iso) {
    formatted['ISO'] = exif.iso.toString()
  }
  
  if (exif.focalLength) {
    formatted['焦距'] = `${exif.focalLength}mm`
  }
  
  if (exif.lensModel) {
    formatted['镜头'] = exif.lensModel
  }
  
  if (exif.gpsLatitude && exif.gpsLongitude) {
    formatted['GPS位置'] = `${exif.gpsLatitude.toFixed(6)}, ${exif.gpsLongitude.toFixed(6)}`
  }
  
  return formatted
}

/**
 * 格式化曝光时间
 */
function formatExposureTime(exposureTime: string | number): string {
  const time = typeof exposureTime === 'string' ? parseFloat(exposureTime) : exposureTime
  
  if (time >= 1) {
    return `${time.toFixed(1)}s`
  } else {
    return `1/${Math.round(1 / time)}s`
  }
}

/**
 * 格式化日期时间
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

