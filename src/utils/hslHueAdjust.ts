import type { HslHueRegionAdjust, HslHueRegionId, ImageEditSettings } from '../types'

export const HSL_HUE_REGIONS: { id: HslHueRegionId; label: string; hue: number }[] = [
  { id: 'red', label: '红', hue: 0 },
  { id: 'orange', label: '橙', hue: 30 },
  { id: 'yellow', label: '黄', hue: 55 },
  { id: 'green', label: '绿', hue: 120 },
  { id: 'cyan', label: '青', hue: 180 },
  { id: 'blue', label: '蓝', hue: 220 },
  { id: 'purple', label: '紫', hue: 270 },
  { id: 'magenta', label: '品红', hue: 310 },
]

const REGION_WIDTH = 42

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function regionWeight(pixelHue: number, centerHue: number): number {
  const d = hueDistance(pixelHue, centerHue)
  if (d >= REGION_WIDTH) return 0
  const t = 1 - d / REGION_WIDTH
  return t * t * (3 - 2 * t)
}

export function isHslHueAdjustDefault(adj?: ImageEditSettings['hslHueAdjust']): boolean {
  if (!adj) return true
  for (const region of HSL_HUE_REGIONS) {
    const v = adj[region.id]
    if (!v) continue
    if ((v.h ?? 0) !== 0 || (v.s ?? 0) !== 0 || (v.l ?? 0) !== 0) return false
  }
  return true
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
  else if (max === gn) h = ((bn - rn) / d + 2) * 60
  else h = ((rn - gn) / d + 4) * 60
  return [h, s * 100, l * 100]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = clamp(s, 0, 100) / 100
  const ln = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h % 360) / 60) % 2 - 1))
  const m = ln - c / 2
  let r = 0
  let g = 0
  let b = 0
  const hh = h % 360
  if (hh < 60) {
    r = c
    g = x
  } else if (hh < 120) {
    r = x
    g = c
  } else if (hh < 180) {
    g = c
    b = x
  } else if (hh < 240) {
    g = x
    b = c
  } else if (hh < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

/**
 * 对 RGB 像素缓冲应用 HSL 分色相调整（原地修改）。
 */
export function applyHslHueAdjustToBuffer(
  data: Uint8Array,
  channels: number,
  adjust: NonNullable<ImageEditSettings['hslHueAdjust']>
): void {
  const regions = HSL_HUE_REGIONS.map(r => ({
    center: r.hue,
    adj: adjust[r.id] ?? {},
  }))

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const [h0, s0, l0] = rgbToHsl(r, g, b)
    if (s0 < 4) continue

    let dh = 0
    let ds = 0
    let dl = 0
    let wSum = 0

    for (const { center, adj } of regions) {
      const w = regionWeight(h0, center)
      if (w <= 0) continue
      wSum += w
      dh += (adj.h ?? 0) * w
      ds += (adj.s ?? 0) * w
      dl += (adj.l ?? 0) * w
    }

    if (wSum <= 0) continue
    const h = (h0 + (dh / wSum) * 0.6 + 360) % 360
    const s = clamp(s0 + ds / wSum, 0, 100)
    const l = clamp(l0 + dl / wSum, 0, 100)
    const [nr, ng, nb] = hslToRgb(h, s, l)
    data[i] = nr
    data[i + 1] = ng
    data[i + 2] = nb
  }
}
