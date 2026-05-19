import sharp from 'sharp'
import { join, dirname, basename, extname } from 'path'
import type { FocusAdjustMode, FocusAdjustOptions } from '../../../src/types'

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** 锐化 sigma：中等强度即可见，100 时较强 */
function mapSharpenSigma(strength: number, mode: FocusAdjustMode): number {
  const t = clamp01(strength / 100)
  const base = 1.2 + Math.pow(t, 0.85) * 7
  return mode === 'regionSharpen' ? base * 1.15 : base
}

/** 虚化 sigma：默认档位即可明显区分前后景 */
function mapBlurSigma(strength: number, mode: FocusAdjustMode): number {
  const t = clamp01(strength / 100)
  const mapped = 3 + Math.pow(t, 1.25) * 22
  if (mode === 'subjectRecover') {
    return Math.max(mapped, 5)
  }
  return mapped
}

function buildRadialMaskSvg(
  width: number,
  height: number,
  focusX: number,
  focusY: number,
  radiusRatio: number,
  feather: number
): string {
  const cx = clamp01(focusX) * width
  const cy = clamp01(focusY) * height
  const r = Math.max(12, radiusRatio * Math.min(width, height))
  const featherT = clamp01(feather / 100)
  const innerStop = Math.max(0, Math.min(92, (1 - featherT * 0.75) * 100))

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="focusMask" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="white"/>
      <stop offset="${innerStop}%" stop-color="white"/>
      <stop offset="100%" stop-color="black"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#focusMask)"/>
</svg>`
}

async function buildFocusLayer(
  filePath: string,
  strength: number,
  mode: FocusAdjustMode
): Promise<Buffer> {
  const sigma = mapSharpenSigma(strength, mode)
  let pipeline = sharp(filePath).sharpen(sigma, 1.4, 2.5)

  if (strength >= 25) {
    pipeline = pipeline.sharpen(sigma * 0.55, 1, 0.5)
  }

  if (mode === 'regionSharpen') {
    const contrast = 1 + clamp01(strength / 100) * 0.35
    pipeline = pipeline.linear(contrast, -(128 * (contrast - 1)))
  } else {
    pipeline = pipeline.modulate({ brightness: 1.05, saturation: 1.08 })
  }

  return pipeline.toBuffer()
}

async function buildBackgroundLayer(
  filePath: string,
  blurStrength: number,
  mode: FocusAdjustMode
): Promise<Buffer> {
  const useBlur = mode === 'subjectRecover' || blurStrength > 2
  if (!useBlur) {
    return sharp(filePath).toBuffer()
  }

  const sigma = mapBlurSigma(blurStrength, mode)
  return sharp(filePath)
    .blur(sigma)
    .modulate({ brightness: 0.94, saturation: 0.82 })
    .toBuffer()
}

export async function renderFocusAdjust(
  filePath: string,
  options: FocusAdjustOptions
): Promise<Buffer> {
  const meta = await sharp(filePath).metadata()
  const width = meta.width || 0
  const height = meta.height || 0
  if (width < 1 || height < 1) {
    throw new Error('无法读取图片尺寸')
  }

  const maskSvg = buildRadialMaskSvg(
    width,
    height,
    options.focusX,
    options.focusY,
    clamp01(options.radius),
    options.feather
  )

  const maskBuffer = await sharp(Buffer.from(maskSvg))
    .resize(width, height)
    .greyscale()
    .raw()
    .toBuffer()

  const [sharpLayer, backgroundLayer] = await Promise.all([
    buildFocusLayer(filePath, options.sharpenStrength, options.mode),
    buildBackgroundLayer(filePath, options.backgroundBlur, options.mode)
  ])

  const focusWithAlpha = await sharp(sharpLayer)
    .ensureAlpha()
    .joinChannel(maskBuffer, {
      raw: { width, height, channels: 1 }
    })
    .png()
    .toBuffer()

  return sharp(backgroundLayer).composite([{ input: focusWithAlpha, blend: 'over' }]).toBuffer()
}

export async function previewFocusAdjust(
  filePath: string,
  options: FocusAdjustOptions
): Promise<string> {
  const buffer = await renderFocusAdjust(filePath, options)
  const jpeg = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}

export async function applyFocusAdjust(
  filePath: string,
  options: FocusAdjustOptions
): Promise<string> {
  const buffer = await renderFocusAdjust(filePath, options)
  const dir = options.outputPath?.trim() || dirname(filePath)
  const ext = extname(filePath) || '.jpg'
  const base = basename(filePath, ext)
  const outputPath = join(dir, `${base}_focus${ext}`)

  const pipeline = sharp(buffer)
  const lower = ext.toLowerCase()
  if (lower === '.png') {
    await pipeline.png().toFile(outputPath)
  } else if (lower === '.webp') {
    await pipeline.webp({ quality: 88 }).toFile(outputPath)
  } else {
    await pipeline.jpeg({ quality: 92 }).toFile(outputPath)
  }

  return outputPath
}
