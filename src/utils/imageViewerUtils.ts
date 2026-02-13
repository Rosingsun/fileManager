/**
 * 图片查看器工具函数
 */

export function calculateFitScale(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number
): number {
  const scaleX = containerWidth / imageWidth
  const scaleY = containerHeight / imageHeight
  return Math.min(scaleX, scaleY, 1) * 100
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
