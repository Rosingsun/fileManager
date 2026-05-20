import type { ImageEditSettings } from '../types'

/**
 * 在图像内计算指定宽高比下的最大内接裁切矩形（居中），用于比例预设。
 */
export function computeCropRectForAspectRatio(
  imageWidth: number,
  imageHeight: number,
  aspectW: number,
  aspectH: number
): { x: number; y: number; width: number; height: number } {
  const iw = Math.max(0, Math.round(imageWidth))
  const ih = Math.max(0, Math.round(imageHeight))
  if (iw === 0 || ih === 0) return { x: 0, y: 0, width: 0, height: 0 }
  if (aspectW <= 0 || aspectH <= 0) return { x: 0, y: 0, width: iw, height: ih }

  const r = aspectW / aspectH
  const hMax = Math.min(ih, Math.floor(iw / r))
  let height = hMax
  let width = Math.round(height * r)
  if (width > iw) {
    width = iw
    height = Math.round(width / r)
  }
  if (height > ih) {
    height = ih
    width = Math.round(height * r)
  }
  width = Math.min(width, iw)
  height = Math.min(height, ih)
  const x = Math.round((iw - width) / 2)
  const y = Math.round((ih - height) / 2)
  return { x, y, width, height }
}

const BASIC_PREVIEW_KEYS: (keyof ImageEditSettings)[] = [
  'brightness',
  'contrast',
  'saturation',
  'hue',
  'exposure',
  'grayscale',
  'blur',
  'vintage',
  'rotation',
  'flipHorizontal',
  'flipVertical',
]

const SHARP_PREVIEW_KEYS: (keyof ImageEditSettings)[] = [
  'sharpen',
  'shadows',
  'highlights',
  'clarity',
  'tint',
  'temperature',
  'gamma',
  'vignette',
  'fade',
  'grain',
  'denoise',
  'crop',
]

function isActiveValue(key: keyof ImageEditSettings, settings: ImageEditSettings): boolean {
  const v = settings[key]
  if (v == null) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') {
    if (key === 'brightness' || key === 'contrast' || key === 'saturation' || key === 'exposure') {
      return v !== 100
    }
    if (key === 'hue' || key === 'rotation') return v !== 0
    if (key === 'gamma') return v !== 100
    return v !== 0
  }
  if (typeof v === 'object' && key === 'crop') return true
  return false
}

/** 是否仅需 CSS 即可预览（无 Sharp 专属项） */
export function needsBasicCssOnly(settings: ImageEditSettings): boolean {
  return !SHARP_PREVIEW_KEYS.some(k => isActiveValue(k, settings))
}

/** 是否需要 Sharp 降采样预览（高级效果） */
export function needsSharpPreview(settings: ImageEditSettings): boolean {
  return SHARP_PREVIEW_KEYS.some(k => isActiveValue(k, settings))
}

export function hasAnyEdit(settings: ImageEditSettings): boolean {
  return [...BASIC_PREVIEW_KEYS, ...SHARP_PREVIEW_KEYS].some(k => isActiveValue(k, settings))
}

/** 对比视图用全画幅预览，避免裁切后效果图只显示局部 */
export function settingsForComparePreview(settings: ImageEditSettings): ImageEditSettings {
  const { crop: _crop, ...rest } = settings
  return rest
}

export function countActiveEdits(settings: ImageEditSettings): number {
  return [...BASIC_PREVIEW_KEYS, ...SHARP_PREVIEW_KEYS].filter(k => isActiveValue(k, settings)).length
}

export type EditPanelGroup = 'adjust' | 'color' | 'effects' | 'transform'

/** 按面板重置为默认值（不改变其它面板参数） */
export function resetEditPanel(group: EditPanelGroup): Partial<ImageEditSettings> {
  switch (group) {
    case 'adjust':
      return {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        exposure: 100,
        hue: 0,
        denoise: 0,
      }
    case 'color':
      return {
        temperature: 0,
        tint: 0,
        gamma: 100,
        shadows: 0,
        highlights: 0,
        clarity: 0,
      }
    case 'effects':
      return {
        grayscale: false,
        vintage: 0,
        blur: 0,
        sharpen: 0,
        vignette: 0,
        fade: 0,
        grain: 0,
      }
    case 'transform':
      return {
        rotation: 0,
        flipHorizontal: false,
        flipVertical: false,
        crop: undefined,
      }
    default:
      return {}
  }
}

export function getFilterCss(settings: ImageEditSettings): string {
  const filters: string[] = []
  if (settings.brightness != null && settings.brightness !== 100) {
    filters.push(`brightness(${settings.brightness}%)`)
  }
  if (settings.contrast != null && settings.contrast !== 100) {
    filters.push(`contrast(${settings.contrast}%)`)
  }
  if (settings.saturation != null && settings.saturation !== 100) {
    filters.push(`saturate(${settings.saturation}%)`)
  }
  if (settings.hue != null && settings.hue !== 0) {
    filters.push(`hue-rotate(${settings.hue}deg)`)
  }
  if (settings.exposure != null && settings.exposure !== 100) {
    filters.push(`brightness(${settings.exposure}%)`)
  }
  if (settings.grayscale) filters.push('grayscale(100%)')
  if (settings.blur != null && settings.blur > 0) filters.push(`blur(${settings.blur}px)`)
  if (settings.vintage != null && settings.vintage > 0) filters.push(`sepia(${settings.vintage}%)`)
  if (settings.temperature != null && settings.temperature !== 0) {
    const warm = settings.temperature > 0
    filters.push(`sepia(${Math.abs(settings.temperature) * 0.15}%)`)
    if (!warm) filters.push(`hue-rotate(${settings.temperature * 0.2}deg)`)
  }
  if (settings.tint != null && settings.tint !== 0) {
    filters.push(`hue-rotate(${settings.tint * 0.35}deg)`)
  }
  if (settings.gamma != null && settings.gamma !== 100) {
    const g = settings.gamma / 100
    filters.push(`contrast(${Math.round(g * 100)}%)`)
  }
  if (settings.shadows != null && settings.shadows !== 0) {
    filters.push(`brightness(${100 + settings.shadows * 0.25}%)`)
  }
  if (settings.highlights != null && settings.highlights !== 0) {
    filters.push(`brightness(${100 - settings.highlights * 0.15}%)`)
  }
  if (settings.clarity != null && settings.clarity !== 0) {
    filters.push(`contrast(${100 + settings.clarity * 0.2}%)`)
  }
  if (settings.sharpen != null && settings.sharpen > 0) {
    filters.push(`contrast(${100 + settings.sharpen * 0.08}%)`)
  }
  if (settings.fade != null && settings.fade > 0) {
    filters.push(`brightness(${100 + settings.fade * 0.12}%)`)
    filters.push(`contrast(${100 - settings.fade * 0.08}%)`)
  }
  return filters.length > 0 ? filters.join(' ') : 'none'
}

export function numSetting(
  settings: ImageEditSettings,
  key: keyof ImageEditSettings,
  def: number
): number {
  const v = settings[key]
  return typeof v === 'number' ? v : def
}

export function getTransformCss(settings: ImageEditSettings): string {
  const transforms: string[] = []
  if (settings.rotation) transforms.push(`rotate(${settings.rotation}deg)`)
  if (settings.flipHorizontal) transforms.push('scaleX(-1)')
  if (settings.flipVertical) transforms.push('scaleY(-1)')
  return transforms.length > 0 ? transforms.join(' ') : 'none'
}
