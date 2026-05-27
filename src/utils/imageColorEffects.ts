/** 鲜明度：低饱和区域增益更大 */
export function applyVibranceToBuffer(
  data: Uint8Array,
  channels: number,
  amount: number
): void {
  if (amount === 0) return
  const factor = amount / 100
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    const boost = factor * (1 - sat) * 0.85
    const avg = (r + g + b) / 3
    data[i] = clampByte(r + (r - avg) * boost)
    data[i + 1] = clampByte(g + (g - avg) * boost)
    data[i + 2] = clampByte(b + (b - avg) * boost)
  }
}

/** 去雾：提升中间调对比与轻微饱和 */
export function applyDehazeToBuffer(
  data: Uint8Array,
  channels: number,
  amount: number
): void {
  if (amount <= 0) return
  const strength = amount / 100
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const haze = Math.max(0, (lum - 140) / 115)
    const lift = strength * haze * 0.35
    const contrast = 1 + strength * (0.25 + haze * 0.2)
    const avg = (r + g + b) / 3
    let nr = avg + (r - avg) * contrast + lift * 28
    let ng = avg + (g - avg) * contrast + lift * 28
    let nb = avg + (b - avg) * contrast + lift * 28
    const satBoost = 1 + strength * 0.12
    nr = avg + (nr - avg) * satBoost
    ng = avg + (ng - avg) * satBoost
    nb = avg + (nb - avg) * satBoost
    data[i] = clampByte(nr)
    data[i + 1] = clampByte(ng)
    data[i + 2] = clampByte(nb)
  }
}

function clampByte(v: number) {
  return Math.min(255, Math.max(0, Math.round(v)))
}
