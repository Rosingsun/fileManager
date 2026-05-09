/**
 * 使用 ExifTool 读取快门次数（依赖厂商 MakerNote，覆盖面远大于纯 EXIF 解析）
 */

import { existsSync } from 'fs'

export interface ShutterCountResult {
  count: number | null
  /** 未找到或错误时的说明 */
  message?: string
}

export async function shutdownExiftool(): Promise<void> {
  try {
    const { exiftool } = await import('exiftool-vendored')
    await exiftool.end()
  } catch {
    // 未安装或未加载时忽略
  }
}

function toPositiveInt(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'bigint') {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
  }
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.round(v)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.raw === 'number') return toPositiveInt(o.raw)
    if (typeof o.value === 'number') return toPositiveInt(o.value)
  }
  const s = String(v).trim()
  const m = s.match(/\d+/)
  if (!m) return null
  const n = parseInt(m[0], 10)
  return Number.isNaN(n) || n < 0 ? null : n
}

function extractShutterFromTags(tags: Record<string, unknown>): number | null {
  const priorityKeys = [
    'ShutterCount',
    'CameraShutterCount',
    'NikonShutterCount',
    'CanonShutterCount',
    'SonyShutterCount',
    'ShutterCount2',
    'ImageCount'
  ]
  for (const k of priorityKeys) {
    const n = toPositiveInt(tags[k])
    if (n !== null && n > 0) return n
  }

  for (const [key, val] of Object.entries(tags)) {
    if (key === 'errors' || key === 'Error') continue
    if (!/(shutter|actuation)/i.test(key)) continue
    if (/(serial|fraction|speed|max|min|time|length|list)/i.test(key)) continue
    const n = toPositiveInt(val)
    if (n !== null && n > 0 && n < 10_000_000) return n
  }
  return null
}

/**
 * 从本地图像文件读取快门次数（JPEG/RAW 等，依 ExifTool 支持）
 */
export async function readShutterCountFromFile(filePath: string): Promise<ShutterCountResult> {
  const pathTrim = filePath?.trim()
  if (!pathTrim) return { count: null }
  if (!existsSync(pathTrim)) {
    return { count: null, message: '文件不存在或路径无效' }
  }

  try {
    const { exiftool } = await import('exiftool-vendored')
    const tags = (await exiftool.read(pathTrim)) as Record<string, unknown>
    const n = extractShutterFromTags(tags)
    if (n !== null) return { count: n }

    return {
      count: null,
      message: '未在元数据中找到快门次数（部分手机/导出图/经软件保存的图片可能不含此项）'
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/cannot find module|ERR_MODULE_NOT_FOUND|Qualified path resolution/i.test(msg)) {
      return {
        count: null,
        message: '未安装 exiftool-vendored：请完全退出应用后在项目根目录执行 npm install'
      }
    }
    return { count: null, message: `读取失败：${msg}` }
  }
}
