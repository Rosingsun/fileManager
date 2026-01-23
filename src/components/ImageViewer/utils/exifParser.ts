/**
 * EXIF数据解析工具
 */

import type { ExifData } from '../types'
import exifr from 'exifr'

/**
 * 从图片URL中读取并解析EXIF信息
 */
export async function extractExifFromUrl(imageUrl: string): Promise<ExifData | null> {
  try {
    // 使用exifr库从图片URL中读取EXIF数据
    // 不设置all选项，exifr默认会解析所有可用的EXIF字段
    const exifData = await exifr.parse(imageUrl, {
      // 启用GPS数据解析
      gps: true,
      // 启用完整的EXIF数据解析
      tiff: true,
      // 启用IPTC数据解析（可选）
      iptc: false,
      // 启用XMP数据解析（可选）
      xmp: false
    })

    if (!exifData) {
      return null
    }

    // 转换为我们需要的ExifData格式，保留所有EXIF字段
    const result: ExifData = {
      make: exifData.Make,
      model: exifData.Model,
      exposureTime: exifData.ExposureTime,
      fNumber: exifData.FNumber,
      iso: exifData.ISO,
      focalLength: exifData.FocalLength,
      lensModel: exifData.LensModel || exifData.Lens,
      dateTimeOriginal: exifData.DateTimeOriginal,
      gpsLatitude: exifData.latitude,
      gpsLongitude: exifData.longitude,
      // 添加更多常用EXIF字段
      ApertureValue: exifData.ApertureValue,
      ExposureBiasValue: exifData.ExposureBiasValue,
      MeteringMode: exifData.MeteringMode,
      ExposureProgram: exifData.ExposureProgram,
      WhiteBalance: exifData.WhiteBalance,
      ResolutionUnit: exifData.ResolutionUnit,
      Orientation: exifData.Orientation,
      // 保留所有其他EXIF字段
      ...exifData
    }

    return result
  } catch (error) {
    console.error('Failed to extract EXIF data:', error)
    return null
  }
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
  
  // 添加更多EXIF字段
  if (exif.ApertureValue) {
    formatted['光圈值'] = exif.ApertureValue.toString()
  }
  
  if (exif.ExposureBiasValue) {
    formatted['曝光补偿'] = `${exif.ExposureBiasValue} EV`
  }
  
  if (exif.MeteringMode) {
    formatted['测光模式'] = formatMeteringMode(exif.MeteringMode)
  }
  
  if (exif.ExposureProgram) {
    formatted['曝光程序'] = formatExposureProgram(exif.ExposureProgram)
  }
  
  if (exif.WhiteBalance) {
    formatted['白平衡'] = formatWhiteBalance(exif.WhiteBalance)
  }
  
  if (exif.ResolutionUnit) {
    formatted['分辨率单位'] = formatResolutionUnit(exif.ResolutionUnit)
  }
  
  if (exif.Orientation) {
    formatted['方向'] = formatOrientation(exif.Orientation)
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

/**
 * 格式化测光模式
 */
function formatMeteringMode(mode: number | string): string {
  const meteringModes: Record<number | string, string> = {
    0: '未知',
    1: '平均',
    2: '中央重点平均',
    3: '点测光',
    4: '多点测光',
    5: '多段测光',
    6: '部分',
    255: '其他'
  }
  return meteringModes[mode] || mode.toString()
}

/**
 * 格式化曝光程序
 */
function formatExposureProgram(program: number | string): string {
  const exposurePrograms: Record<number | string, string> = {
    0: '未定义',
    1: '手动',
    2: '正常程序',
    3: '光圈优先',
    4: '快门优先',
    5: '创意程序',
    6: '动作程序',
    7: '肖像模式',
    8: '风景模式'
  }
  return exposurePrograms[program] || program.toString()
}

/**
 * 格式化白平衡
 */
function formatWhiteBalance(balance: number | string): string {
  const whiteBalances: Record<number | string, string> = {
    0: '自动',
    1: '手动'
  }
  return whiteBalances[balance] || balance.toString()
}

/**
 * 格式化分辨率单位
 */
function formatResolutionUnit(unit: number | string): string {
  const resolutionUnits: Record<number | string, string> = {
    1: '无单位',
    2: '英寸',
    3: '厘米'
  }
  return resolutionUnits[unit] || unit.toString()
}

/**
 * 格式化方向
 */
function formatOrientation(orientation: number | string): string {
  const orientations: Record<number | string, string> = {
    1: '正常',
    2: '水平翻转',
    3: '旋转180°',
    4: '垂直翻转',
    5: '顺时针旋转90°并水平翻转',
    6: '顺时针旋转90°',
    7: '顺时针旋转90°并垂直翻转',
    8: '逆时针旋转90°'
  }
  return orientations[orientation] || orientation.toString()
}

