import type { ImageEditSettings } from '../types'

export interface ToneCurvePoint {
  x: number
  y: number
}

export const DEFAULT_TONE_CURVE_POINTS: ToneCurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

export const DEFAULT_LEVELS = { black: 0, white: 255, gamma: 100 } as const

export type ToneCurveChannelKey = 'master' | 'red' | 'green' | 'blue'

export interface ToneLutResult {
  master?: Uint8Array
  red?: Uint8Array
  green?: Uint8Array
  blue?: Uint8Array
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

function channelPointsDefault(points?: ToneCurvePoint[]): boolean {
  if (!points?.length) return true
  const pts = normalizeCurvePoints(points)
  if (pts.length !== 2) return false
  return pts[0].x === 0 && pts[0].y === 0 && pts[1].x === 1 && pts[1].y === 1
}

export function isLevelsDefault(levels: ImageEditSettings['levels']): boolean {
  if (!levels) return true
  return (
    levels.black === DEFAULT_LEVELS.black &&
    levels.white === DEFAULT_LEVELS.white &&
    levels.gamma === DEFAULT_LEVELS.gamma
  )
}

export function isToneCurveDefault(curve: ImageEditSettings['toneCurve']): boolean {
  if (!curve) return true
  return (
    channelPointsDefault(curve.master) &&
    channelPointsDefault(curve.red) &&
    channelPointsDefault(curve.green) &&
    channelPointsDefault(curve.blue)
  )
}

export function normalizeCurvePoints(points: ToneCurvePoint[]): ToneCurvePoint[] {
  const sorted = [...points]
    .map(p => ({ x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) }))
    .sort((a, b) => a.x - b.x)
  if (sorted.length === 0) return [...DEFAULT_TONE_CURVE_POINTS]
  const out: ToneCurvePoint[] = []
  if (sorted[0].x > 0) out.push({ x: 0, y: sorted[0].y })
  for (const p of sorted) {
    if (out.length === 0 || p.x > out[out.length - 1].x) out.push(p)
  }
  const last = out[out.length - 1]
  if (!last || last.x < 1) out.push({ x: 1, y: last?.y ?? 1 })
  if (out[0].x !== 0) out.unshift({ x: 0, y: out[0].y })
  if (out[out.length - 1].x !== 1) out.push({ x: 1, y: out[out.length - 1].y })
  return out
}

function interpCurveY(points: ToneCurvePoint[], x: number): number {
  if (x <= points[0].x) return points[0].y
  if (x >= points[points.length - 1].x) return points[points.length - 1].y
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (x >= a.x && x <= b.x) {
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x)
      return a.y + t * (b.y - a.y)
    }
  }
  return points[points.length - 1].y
}

export function buildLevelsLut(levels: NonNullable<ImageEditSettings['levels']>): Uint8Array {
  const lut = new Uint8Array(256)
  const black = clamp(Math.round(levels.black), 0, 254)
  const white = clamp(Math.round(levels.white), black + 1, 255)
  const gamma = Math.max(0.2, levels.gamma / 100)

  for (let i = 0; i < 256; i++) {
    let v = (i - black) / (white - black)
    v = clamp(v, 0, 1)
    v = Math.pow(v, 1 / gamma)
    lut[i] = Math.round(v * 255)
  }
  return lut
}

export function buildCurveLut(points: ToneCurvePoint[]): Uint8Array {
  const normalized = normalizeCurvePoints(points)
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const x = i / 255
    lut[i] = Math.round(clamp(interpCurveY(normalized, x), 0, 1) * 255)
  }
  for (let i = 1; i < 256; i++) {
    if (lut[i] < lut[i - 1]) lut[i] = lut[i - 1]
  }
  return lut
}

function chainLut(base: Uint8Array, extra: Uint8Array): Uint8Array {
  const next = new Uint8Array(256)
  for (let i = 0; i < 256; i++) next[i] = extra[base[i]]
  return next
}

function buildLevelsOnlyLut(levels?: ImageEditSettings['levels']): Uint8Array | null {
  if (!levels || isLevelsDefault(levels)) return null
  return buildLevelsLut(levels)
}

function chainLevelsWithCurve(
  levelsLut: Uint8Array | null,
  points?: ToneCurvePoint[]
): Uint8Array | null {
  let combined = new Uint8Array(256)
  for (let i = 0; i < 256; i++) combined[i] = i
  if (levelsLut) combined = chainLut(combined, levelsLut)
  if (points && !channelPointsDefault(points)) {
    combined = chainLut(combined, buildCurveLut(points))
  }
  for (let i = 0; i < 256; i++) {
    if (combined[i] !== i) return combined
  }
  return null
}

export function composeLuts(
  levels?: ImageEditSettings['levels'],
  toneCurve?: ImageEditSettings['toneCurve']
): ToneLutResult | null {
  if (!toneCurve && (!levels || isLevelsDefault(levels))) return null

  const levelsLut = buildLevelsOnlyLut(levels)
  const masterLut = chainLevelsWithCurve(levelsLut, toneCurve?.master)
  const redLut = chainLevelsWithCurve(levelsLut, toneCurve?.red)
  const greenLut = chainLevelsWithCurve(levelsLut, toneCurve?.green)
  const blueLut = chainLevelsWithCurve(levelsLut, toneCurve?.blue)

  const hasRgbChannel =
    (toneCurve?.red && !channelPointsDefault(toneCurve.red)) ||
    (toneCurve?.green && !channelPointsDefault(toneCurve.green)) ||
    (toneCurve?.blue && !channelPointsDefault(toneCurve.blue))

  if (!masterLut && !hasRgbChannel && !levelsLut) return null

  if (hasRgbChannel) {
    const identity = new Uint8Array(256)
    for (let i = 0; i < 256; i++) identity[i] = i
    return {
      red: redLut ?? masterLut ?? identity,
      green: greenLut ?? masterLut ?? identity,
      blue: blueLut ?? masterLut ?? identity,
    }
  }

  if (masterLut) return { master: masterLut }
  if (levelsLut) return { master: levelsLut }
  return null
}

/** 根据直方图分位自动色阶（约 0.5% / 99.5%） */
export function computeAutoLevels(bins: Uint32Array | number[]): {
  black: number
  white: number
  gamma: number
} {
  let total = 0
  for (let i = 0; i < 256; i++) total += bins[i]
  if (total <= 0) return { ...DEFAULT_LEVELS }

  const lowTarget = total * 0.005
  const highTarget = total * 0.005

  let acc = 0
  let black = 0
  for (let i = 0; i < 256; i++) {
    acc += bins[i]
    if (acc >= lowTarget) {
      black = i
      break
    }
  }

  acc = 0
  let white = 255
  for (let i = 255; i >= 0; i--) {
    acc += bins[i]
    if (acc >= highTarget) {
      white = i
      break
    }
  }

  if (white <= black + 8) {
    black = Math.max(0, black - 4)
    white = Math.min(255, white + 4)
  }

  return { black, white, gamma: 100 }
}

export function getCurvePointsForChannel(
  toneCurve: ImageEditSettings['toneCurve'] | undefined,
  channel: ToneCurveChannelKey
): ToneCurvePoint[] {
  if (channel === 'master') {
    return normalizeCurvePoints(toneCurve?.master ?? DEFAULT_TONE_CURVE_POINTS)
  }
  return normalizeCurvePoints(toneCurve?.[channel] ?? DEFAULT_TONE_CURVE_POINTS)
}
