/** 从采样 RGB 推算色温/色调（灰点白平衡近似） */
export function rgbToWhiteBalance(r: number, g: number, b: number): {
  temperature: number
  tint: number
} {
  const sum = r + g + b
  if (sum < 12) return { temperature: 0, tint: 0 }

  const rn = r / sum
  const gn = g / sum
  const bn = b / sum
  const neutral = 1 / 3

  const warmBias = rn - bn
  const greenBias = gn - neutral

  const temperature = Math.round(clamp(-warmBias * 220, -100, 100))
  const tint = Math.round(clamp(-greenBias * 200, -100, 100))
  return { temperature, tint }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}
