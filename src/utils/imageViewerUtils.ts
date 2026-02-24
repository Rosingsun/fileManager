/**
 * 图片查看器工具函数
 */

export function calculateFitScale(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
  targetRatio: number = 1
): number {
  const scaleX = (containerWidth * targetRatio) / imageWidth
  const scaleY = (containerHeight * targetRatio) / imageHeight
  return Math.min(scaleX, scaleY) * 100
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
