/**
 * 从本地图片元数据读取人脸/主体对焦点（MWG Region、MP Region、EXIF SubjectArea 等）
 */

import { existsSync } from 'fs'

export interface PhotoFocusPoint {
  x: number
  y: number
  weight?: number
}

export interface PhotoFocusPointsResult {
  points: PhotoFocusPoint[]
}

function toNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'bigint') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.value === 'number') return o.value
    if (typeof o.raw === 'number') return o.raw
  }
  const s = String(v).trim()
  const n = parseFloat(s.replace(/,/g, ' ').split(/\s+/)[0] ?? '')
  return Number.isFinite(n) ? n : null
}

function parseNumericTuple(v: unknown): number[] | null {
  if (Array.isArray(v)) {
    const nums = v.map(toNumber).filter((n): n is number => n !== null)
    return nums.length >= 2 ? nums : null
  }
  if (typeof v === 'string') {
    const nums = v
      .trim()
      .split(/[\s,]+/)
      .map(s => parseFloat(s))
      .filter(n => Number.isFinite(n))
    return nums.length >= 2 ? nums : null
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    const keys = ['X', 'Y', 'W', 'H', 'x', 'y', 'w', 'h', 'Width', 'Height']
    const nums: number[] = []
    for (const k of keys) {
      if (k in o) {
        const n = toNumber(o[k])
        if (n !== null) nums.push(n)
      }
    }
    if (nums.length >= 4) return nums.slice(0, 4)
    if (nums.length >= 2) return nums.slice(0, 2)
  }
  return null
}

function normalizeCoord(value: number, imageDim: number): number {
  if (imageDim > 0 && value > 1.5) return value / imageDim
  if (value > 1 && value <= 100 && imageDim <= 0) return value / 100
  return value
}

function areaToCenter(
  nums: number[],
  imageW: number,
  imageH: number,
  centerBased: boolean
): PhotoFocusPoint | null {
  if (nums.length < 2) return null
  let [a, b, c, d] = nums
  a = normalizeCoord(a, imageW)
  b = normalizeCoord(b, imageH)
  if (nums.length >= 4) {
    c = normalizeCoord(c, imageW)
    d = normalizeCoord(d, imageH)
  } else {
    c = 0
    d = 0
  }

  let cx: number
  let cy: number
  let weight = 0.5

  if (nums.length >= 4) {
    if (centerBased) {
      cx = a
      cy = b
      weight = Math.max(c * d, 0.01)
    } else {
      cx = a + c / 2
      cy = b + d / 2
      weight = Math.max(c * d, 0.01)
    }
  } else {
    cx = a
    cy = b
  }

  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null
  if (cx < -0.05 || cy < -0.05 || cx > 1.05 || cy > 1.05) return null

  return {
    x: Math.min(1, Math.max(0, cx)),
    y: Math.min(1, Math.max(0, cy)),
    weight
  }
}

function extractFromRegionList(
  list: unknown,
  imageW: number,
  imageH: number,
  centerBased: boolean,
  out: PhotoFocusPoint[]
): void {
  if (!list) return
  const items = Array.isArray(list) ? list : [list]
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const type = String(o.Type ?? o.RegionType ?? o.type ?? '').trim()
    if (type && /^(Barcode|QRCode)$/i.test(type)) continue

    const area = o.Area ?? o.Rectangle ?? o.RegionArea ?? o.area
    const nums = parseNumericTuple(area)
    if (nums) {
      const pt = areaToCenter(nums, imageW, imageH, centerBased || /^(Face|Focus|Person|Pet)$/i.test(type))
      if (pt) out.push(pt)
    }
  }
}

function walkForRegions(
  value: unknown,
  imageW: number,
  imageH: number,
  depth: number,
  out: PhotoFocusPoint[]
): void {
  if (depth > 8 || value === null || value === undefined) return

  if (Array.isArray(value)) {
    const maybeRegions = value.every(v => v && typeof v === 'object' && ('Area' in (v as object) || 'Rectangle' in (v as object)))
    if (maybeRegions) {
      extractFromRegionList(value, imageW, imageH, true, out)
      return
    }
    for (const item of value) walkForRegions(item, imageW, imageH, depth + 1, out)
    return
  }

  if (typeof value !== 'object') return
  const o = value as Record<string, unknown>

  if ('RegionList' in o || 'Regions' in o) {
    extractFromRegionList(o.RegionList ?? o.Regions, imageW, imageH, true, out)
  }
  if ('Area' in o || 'Rectangle' in o) {
    const nums = parseNumericTuple(o.Area ?? o.Rectangle)
    if (nums) {
      const centerBased = !('Rectangle' in o && !('Area' in o))
      const pt = areaToCenter(nums, imageW, imageH, centerBased)
      if (pt) out.push(pt)
    }
  }

  for (const [key, child] of Object.entries(o)) {
    if (/^(SourceFile|FileName|Directory|MIMEType|errors)$/i.test(key)) continue
    if (/Region/i.test(key) || /Face/i.test(key) || /Area/i.test(key)) {
      walkForRegions(child, imageW, imageH, depth + 1, out)
    }
  }
}

function extractSubjectArea(tags: Record<string, unknown>, imageW: number, imageH: number): PhotoFocusPoint | null {
  const raw = tags.SubjectArea ?? tags.SubjectLocation
  const nums = parseNumericTuple(raw)
  if (!nums || nums.length < 2) return null
  return areaToCenter(nums, imageW, imageH, false)
}

function dedupePoints(points: PhotoFocusPoint[]): PhotoFocusPoint[] {
  const result: PhotoFocusPoint[] = []
  for (const p of points) {
    const dup = result.find(
      q => Math.hypot(q.x - p.x, q.y - p.y) < 0.04
    )
    if (!dup) {
      result.push(p)
    } else if ((p.weight ?? 0) > (dup.weight ?? 0)) {
      const i = result.indexOf(dup)
      result[i] = p
    }
  }
  return result.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
}

function extractFocusPointsFromTags(
  tags: Record<string, unknown>,
  imageW: number,
  imageH: number
): PhotoFocusPoint[] {
  const out: PhotoFocusPoint[] = []

  const regionRoots = [
    tags.RegionInfo,
    tags.MPRegionInfo,
    tags.RegionInfoMP,
    tags.MicrosoftPhoto,
    tags['XMP-mwg-rs:RegionInfo']
  ]
  for (const root of regionRoots) {
    if (root && typeof root === 'object') {
      const o = root as Record<string, unknown>
      extractFromRegionList(o.RegionList ?? o.Regions ?? o, imageW, imageH, true, out)
    }
  }

  walkForRegions(tags, imageW, imageH, 0, out)

  const flatAreaKeys = ['RegionAreaX', 'RegionAreaY', 'RegionAreaW', 'RegionAreaH']
  const hasFlat = flatAreaKeys.every(k => k in tags)
  if (hasFlat) {
    const xs = parseNumericTuple(tags.RegionAreaX)
    const ys = parseNumericTuple(tags.RegionAreaY)
    const ws = parseNumericTuple(tags.RegionAreaW)
    const hs = parseNumericTuple(tags.RegionAreaH)
    if (xs && ys) {
      const count = Math.min(xs.length, ys.length)
      for (let i = 0; i < count; i++) {
        const w = ws?.[i] ?? 0.1
        const h = hs?.[i] ?? 0.1
        const pt = areaToCenter([xs[i], ys[i], w, h], imageW, imageH, true)
        if (pt) out.push(pt)
      }
    }
  }

  const subject = extractSubjectArea(tags, imageW, imageH)
  if (subject) out.push(subject)

  return dedupePoints(out)
}

export async function readPhotoFocusPointsFromFile(filePath: string): Promise<PhotoFocusPointsResult> {
  const pathTrim = filePath?.trim()
  if (!pathTrim || !existsSync(pathTrim)) return { points: [] }

  try {
    const { exiftool } = await import('exiftool-vendored')
    const tags = (await exiftool.read(pathTrim)) as Record<string, unknown>
    const imageW =
      toNumber(tags.ImageWidth) ??
      toNumber(tags.ExifImageWidth) ??
      toNumber(tags.CanonImageWidth) ??
      0
    const imageH =
      toNumber(tags.ImageHeight) ??
      toNumber(tags.ExifImageHeight) ??
      toNumber(tags.CanonImageHeight) ??
      0
    const points = extractFocusPointsFromTags(tags, imageW, imageH)
    return { points }
  } catch {
    return { points: [] }
  }
}
