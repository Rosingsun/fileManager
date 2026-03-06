import type { ImageEditSettings } from '../types'

export function getFilterCss(settings: ImageEditSettings): string {
  const filters: string[] = []
  if (settings.brightness != null) filters.push(`brightness(${settings.brightness}%)`)
  if (settings.contrast != null) filters.push(`contrast(${settings.contrast}%)`)
  if (settings.saturation != null) filters.push(`saturate(${settings.saturation}%)`)
  if (settings.hue != null) filters.push(`hue-rotate(${settings.hue}deg)`)
  if (settings.exposure != null) filters.push(`brightness(${settings.exposure}%)`)
  
  if (settings.grayscale) filters.push('grayscale(100%)')
  if (settings.blur != null && settings.blur > 0) filters.push(`blur(${settings.blur}px)`)
  if (settings.vintage != null && settings.vintage > 0) filters.push(`sepia(${settings.vintage}%)`)
  
  return filters.length > 0 ? filters.join(' ') : 'none'
}

/**
 * 将前端设置转换为 Sharp 管线(在主进程中使用)
 * 返回一个函数，它接受 sharp 实例并返回处理过的实例
 */
export function settingsToSharpPipeline(settings: ImageEditSettings) {
  return (sharpInstance: any) => {
    // 色彩调整
    if (settings.brightness != null || settings.contrast != null || settings.saturation != null || settings.hue != null) {
      const brightness = settings.brightness != null ? settings.brightness / 100 : 1
      const contrast = settings.contrast != null ? settings.contrast / 100 : 1
      const saturation = settings.saturation != null ? settings.saturation / 100 : 1
      const hue = settings.hue != null ? settings.hue : 0
      sharpInstance = sharpInstance.modulate({ brightness, saturation, hue, contrast })
    }
    if (settings.exposure != null) {
      const exposure = settings.exposure / 100
      sharpInstance = sharpInstance.modulate({ brightness: exposure })
    }
    if (settings.rotation) {
      sharpInstance = sharpInstance.rotate(settings.rotation)
    }
    if (settings.flipHorizontal) {
      sharpInstance = sharpInstance.flip()
    }
    if (settings.flipVertical) {
      sharpInstance = sharpInstance.flop()
    }
    if (settings.crop) {
      sharpInstance = sharpInstance.extract({
        left: Math.round(settings.crop.x),
        top: Math.round(settings.crop.y),
        width: Math.round(settings.crop.width),
        height: Math.round(settings.crop.height)
      })
    }
    return sharpInstance
  }
}
