/** 与 EditorHistogram 画布左右 inset（2px）对齐 */
export const HISTOGRAM_INSET_PX = 2

export const clampLevel = (v: number, min: number, max: number) =>
  Math.min(Math.max(Math.round(v), min), max)

export function levelToLeftCss(level: number): string {
  return `calc(${HISTOGRAM_INSET_PX}px + ${level / 255} * (100% - ${HISTOGRAM_INSET_PX * 2}px))`
}

export function clientXToLevel(clientX: number, rect: DOMRect): number {
  const innerW = Math.max(1, rect.width - HISTOGRAM_INSET_PX * 2)
  const t = (clientX - rect.left - HISTOGRAM_INSET_PX) / innerW
  return clampLevel(t * 255, 0, 255)
}

export function levelToClientX(level: number, rect: DOMRect): number {
  const innerW = Math.max(1, rect.width - HISTOGRAM_INSET_PX * 2)
  return rect.left + HISTOGRAM_INSET_PX + (level / 255) * innerW
}

export function pickLevelsHandle(
  clientX: number,
  rect: DOMRect,
  black: number,
  white: number,
  thresholdPx = 24
): 'black' | 'white' | null {
  const bx = levelToClientX(black, rect)
  const wx = levelToClientX(white, rect)
  const db = Math.abs(clientX - bx)
  const dw = Math.abs(clientX - wx)
  if (db <= thresholdPx && db <= dw) return 'black'
  if (dw <= thresholdPx) return 'white'
  return null
}
