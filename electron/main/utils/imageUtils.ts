import sharp from 'sharp'
import { getMimeType } from './fileUtils'
import { resolveStillPathForDisplay } from '../services/mediaAssetService'

export async function getImageDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const { displayPath } = await resolveStillPathForDisplay(filePath)
    const metadata = await sharp(displayPath).metadata()
    if (metadata.width && metadata.height) {
      return { width: metadata.width, height: metadata.height }
    }
    return null
  } catch (error) {
    console.error('[Main] 获取图片尺寸失败:', error)
    return null
  }
}

export async function getImageThumbnail(
  filePath: string,
  size: number = 100,
  quality: number = 60
): Promise<string> {
  try {
    const fs = await import('fs')
    const stats = fs.statSync(filePath)
    const MAX_THUMBNAIL_SIZE = 50 * 1024 * 1024
    
    if (stats.size > MAX_THUMBNAIL_SIZE) {
      console.warn(`[Main] 跳过大于50MB的图片缩略图生成: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`)
      return ''
    }

    const { displayPath } = await resolveStillPathForDisplay(filePath)
    if (displayPath !== filePath && !fs.existsSync(displayPath)) {
      return ''
    }
    
    const mimeType = getMimeType(displayPath)
    const isPng = mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/jpg'
    const isWebp = mimeType === 'image/webp'
    const isGif = mimeType === 'image/gif'
    const isBmp = mimeType === 'image/bmp'
    const isSvg = mimeType === 'image/svg+xml'
    
    const effectiveQuality = Math.max(Math.min(quality || 60, 100), 1)
    const sharpInstance = sharp(displayPath)
      .resize(size, size, { fit: 'cover', position: 'center' })
    
    let buffer: Buffer
    
    if (isPng) {
      buffer = await sharpInstance.jpeg({
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    } else if (isWebp) {
      buffer = await sharpInstance.webp({
        quality: effectiveQuality,
        lossless: effectiveQuality === 100
      }).toBuffer()
    } else if (isGif || isBmp || isSvg) {
      buffer = await sharpInstance.jpeg({
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    } else {
      buffer = await sharpInstance.jpeg({
        quality: effectiveQuality,
        progressive: effectiveQuality > 80,
        chromaSubsampling: effectiveQuality > 80 ? '4:4:4' : '4:2:0'
      }).toBuffer()
    }
    
    const base64 = buffer.toString('base64')
    return `data:image/jpeg;base64,${base64}`
  } catch (error) {
    console.error('[Main] 生成图片缩略图失败:', error)
    return ''
  }
}

/**
 * 读取图片为 data URL。
 * maxEdge 有值时按长边降采样（编辑器预览用），避免 24MP 原图整块 base64 走 IPC 造成卡顿与内存膨胀；
 * 不传则保持原样（查看器、缓存等按原图语义使用）。
 */
export async function getImageBase64(filePath: string, maxEdge?: number): Promise<string> {
  try {
    const { displayPath } = await resolveStillPathForDisplay(filePath)
    const fs = await import('fs')
    const mimeType = getMimeType(displayPath)

    const readFull = async (): Promise<string> => {
      const buffer = await fs.promises.readFile(displayPath)
      return `data:${mimeType};base64,${buffer.toString('base64')}`
    }

    if (!maxEdge || maxEdge <= 0) return await readFull()

    const image = sharp(displayPath)
    const meta = await image.metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    const longest = Math.max(w, h)
    if (w <= 0 || h <= 0 || longest <= maxEdge) return await readFull()

    const scale = maxEdge / longest
    const resized = image.resize(Math.round(w * scale), Math.round(h * scale), {
      fit: 'inside',
      withoutEnlargement: true,
    })

    if (meta.hasAlpha) {
      const buffer = await resized.png({ compressionLevel: 6 }).toBuffer()
      return `data:image/png;base64,${buffer.toString('base64')}`
    }
    const buffer = await resized.jpeg({ quality: 90, mozjpeg: true }).toBuffer()
    return `data:image/jpeg;base64,${buffer.toString('base64')}`
  } catch (error) {
    console.error('[Main] 获取图片base64失败:', error)
    return ''
  }
}

export async function getImageInfo(imagePath: string): Promise<{
  width?: number
  height?: number
  format?: string
  exif?: Record<string, any>
}> {
  try {
    const imageBuffer = await import('fs').then(fs => fs.promises.readFile(imagePath))
    const metadata = await sharp(imageBuffer).metadata()

    const info: any = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    }

    if (metadata.exif) {
      try {
        const exifData = metadata.exif.toString('latin1')
        const exifObj: Record<string, any> = {}
        const exifPatterns: Record<string, RegExp> = {
          camera: /Camera|Make|Model/i,
          lens: /Lens/i,
          datetime: /DateTime/i,
          gps: /GPS/i,
          software: /Software/i
        }
        for (const [key, pattern] of Object.entries(exifPatterns)) {
          if (pattern.test(exifData)) {
            exifObj[key] = true
          }
        }
        if (Object.keys(exifObj).length > 0) {
          info.exif = exifObj
        }
      } catch {}
    }

    return info
  } catch (error) {
    return {}
  }
}

export async function preprocessImage(imagePath: string, inputSize: number = 224): Promise<Float32Array> {
  try {
    const imageBuffer = await import('fs').then(fs => fs.promises.readFile(imagePath))
    const image = sharp(imageBuffer)

    const metadata = await image.metadata()
    console.log(`[分类] 图片信息: ${metadata.width}x${metadata.height}, 格式: ${metadata.format}`)

    const resized = await image
      .resize(inputSize, inputSize, {
        fit: 'fill',
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .raw()
      .toBuffer()

    const expectedLength = inputSize * inputSize * 3
    if (resized.length !== expectedLength) {
      console.error(`[分类] 像素数据长度错误: ${resized.length}, 期望: ${expectedLength}`)
    }

    const pixels = new Float32Array(3 * inputSize * inputSize)
    for (let i = 0; i < resized.length; i += 3) {
      const r = resized[i] / 255.0
      const g = resized[i + 1] / 255.0
      const b = resized[i + 2] / 255.0

      const pixelIndex = Math.floor(i / 3)
      pixels[pixelIndex] = r
      pixels[inputSize * inputSize + pixelIndex] = g
      pixels[2 * inputSize * inputSize + pixelIndex] = b
    }

    console.log(`[分类] 预处理完成，像素数: ${pixels.length}`)
    return pixels
  } catch (error) {
    console.error('[Main] 图片预处理失败:', error)
    throw error
  }
}

// ---------- image editing / format / compression helpers -----------
import type {
  ImageEditSettings,
  FormatConversionOptions,
  CompressionOptions,
  ExportPreviewResult,
} from '../../src/types'
import { composeLuts, type ToneLutResult } from '../../../src/utils/toneCurve'
import { applyHslHueAdjustToBuffer, isHslHueAdjustDefault } from '../../../src/utils/hslHueAdjust'
import { applyDehazeToBuffer, applyVibranceToBuffer } from '../../../src/utils/imageColorEffects'
import type { LuminanceHistogramResult } from '../../../src/utils/imageHistogram'

async function readRawRgb(sharpInstance: sharp.Sharp): Promise<{
  data: Buffer
  width: number
  height: number
  channels: number
} | null> {
  const { data, info } = await sharpInstance.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  if (!width || !height || channels < 3) return null
  return { data, width, height, channels }
}

async function applyToneLuts(sharpInstance: sharp.Sharp, luts: ToneLutResult): Promise<sharp.Sharp> {
  const raw = await readRawRgb(sharpInstance)
  if (!raw) return sharpInstance
  const { data, width, height, channels } = raw
  const arr = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)

  if (luts.master) {
    const lut = luts.master
    for (let i = 0; i < arr.length; i += channels) {
      arr[i] = lut[arr[i]] ?? arr[i]
      arr[i + 1] = lut[arr[i + 1]] ?? arr[i + 1]
      arr[i + 2] = lut[arr[i + 2]] ?? arr[i + 2]
    }
  } else {
    const lr = luts.red
    const lg = luts.green
    const lb = luts.blue
    if (lr || lg || lb) {
      for (let i = 0; i < arr.length; i += channels) {
        if (lr) arr[i] = lr[arr[i]] ?? arr[i]
        if (lg) arr[i + 1] = lg[arr[i + 1]] ?? arr[i + 1]
        if (lb) arr[i + 2] = lb[arr[i + 2]] ?? arr[i + 2]
      }
    }
  }

  return sharp(Buffer.from(arr), {
    raw: { width, height, channels },
  })
}

async function applyPixelEffects(
  sharpInstance: sharp.Sharp,
  settings: ImageEditSettings
): Promise<sharp.Sharp> {
  const needsHsl = settings.hslHueAdjust && !isHslHueAdjustDefault(settings.hslHueAdjust)
  const needsVibrance = settings.vibrance != null && settings.vibrance !== 0
  const needsDehaze = settings.dehaze != null && settings.dehaze > 0
  if (!needsHsl && !needsVibrance && !needsDehaze) return sharpInstance

  const raw = await readRawRgb(sharpInstance)
  if (!raw) return sharpInstance
  const { data, width, height, channels } = raw
  const arr = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)

  if (needsDehaze) applyDehazeToBuffer(arr, channels, settings.dehaze!)
  if (needsVibrance) applyVibranceToBuffer(arr, channels, settings.vibrance!)
  if (needsHsl) applyHslHueAdjustToBuffer(arr, channels, settings.hslHueAdjust!)

  return sharp(Buffer.from(arr), {
    raw: { width, height, channels },
  })
}

/** 统一图片编辑管线：裁切 → 几何 → 色彩 → 局部 → 滤镜 → 锐化/模糊 → 颗粒/暗角 → 降噪 */
export async function buildImageEditPipeline(
  sharpInstance: sharp.Sharp,
  settings: ImageEditSettings
): Promise<sharp.Sharp> {
  if (settings.crop) {
    sharpInstance = sharpInstance.extract({
      left: Math.round(settings.crop.x),
      top: Math.round(settings.crop.y),
      width: Math.round(settings.crop.width),
      height: Math.round(settings.crop.height),
    })
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

  if (
    settings.brightness != null ||
    settings.saturation != null ||
    settings.hue != null
  ) {
    const brightness = settings.brightness != null ? settings.brightness / 100 : 1
    const saturation = settings.saturation != null ? settings.saturation / 100 : 1
    const hue = settings.hue != null ? settings.hue : 0
    sharpInstance = sharpInstance.modulate({ brightness, saturation, hue })
  }

  if (settings.contrast != null && settings.contrast !== 100) {
    const factor = settings.contrast / 100
    sharpInstance = sharpInstance.linear(factor, -(128 * (factor - 1)))
  }

  if (settings.exposure != null && settings.exposure !== 100) {
    sharpInstance = sharpInstance.modulate({ brightness: settings.exposure / 100 })
  }

  if (settings.temperature != null && settings.temperature !== 0) {
    const t = settings.temperature / 100
    const warm = Math.max(0, t)
    const cool = Math.max(0, -t)
    sharpInstance = sharpInstance.recomb([
      [1 + warm * 0.08, cool * 0.02, cool * 0.04],
      [warm * 0.02, 1, cool * 0.02],
      [warm * 0.04, cool * 0.02, 1 + cool * 0.08],
    ])
  }

  if (settings.tint != null && settings.tint !== 0) {
    const tint = settings.tint / 100
    sharpInstance = sharpInstance.modulate({ hue: tint * 8 })
  }

  if (settings.gamma != null && settings.gamma !== 100) {
    const g = Math.max(0.4, Math.min(2.5, settings.gamma / 100))
    sharpInstance = sharpInstance.gamma(g)
  }

  if (settings.fade != null && settings.fade > 0) {
    const lift = (settings.fade / 100) * 28
    sharpInstance = sharpInstance.linear(1, lift)
  }

  if (settings.shadows != null && settings.shadows !== 0) {
    const shadowFactor = 1 + settings.shadows / 200
    sharpInstance = sharpInstance.modulate({ brightness: shadowFactor })
  }

  if (settings.highlights != null && settings.highlights !== 0) {
    const h = settings.highlights / 100
    const factor = 1 - h * 0.12
    const offset = h * 18
    sharpInstance = sharpInstance.linear(factor, offset)
  }

  if (settings.clarity != null && settings.clarity !== 0) {
    const clarityFactor = 1 + settings.clarity / 200
    sharpInstance = sharpInstance.linear(clarityFactor, -(128 * (clarityFactor - 1)))
  }

  const toneLut = composeLuts(settings.levels, settings.toneCurve)
  if (toneLut) {
    sharpInstance = await applyToneLuts(sharpInstance, toneLut)
  }

  sharpInstance = await applyPixelEffects(sharpInstance, settings)

  if (settings.grayscale) {
    sharpInstance = sharpInstance.grayscale()
  }

  if (settings.vintage != null && settings.vintage > 0) {
    const sepiaAmount = settings.vintage / 100
    sharpInstance = sharpInstance.recomb([
      [0.393 + 0.607 * (1 - sepiaAmount), 0.769 - 0.769 * (1 - sepiaAmount), 0.189 - 0.189 * (1 - sepiaAmount)],
      [0.349 - 0.349 * (1 - sepiaAmount), 0.686 + 0.314 * (1 - sepiaAmount), 0.168 - 0.168 * (1 - sepiaAmount)],
      [0.272 - 0.272 * (1 - sepiaAmount), 0.534 - 0.534 * (1 - sepiaAmount), 0.131 + 0.869 * (1 - sepiaAmount)],
    ])
  }

  if (settings.blur != null && settings.blur > 0) {
    sharpInstance = sharpInstance.blur(settings.blur)
  }

  if (settings.sharpen != null && settings.sharpen > 0) {
    const sigma = Math.max(settings.sharpen / 50, 0.3)
    sharpInstance = sharpInstance.sharpen(sigma, 1, 0)
  }

  if (settings.denoise != null && settings.denoise > 0) {
    const size = Math.min(5, Math.max(1, Math.round(settings.denoise / 25)))
    sharpInstance = sharpInstance.median(size)
  }

  if (settings.vignette != null && settings.vignette > 0) {
    const meta = await sharpInstance.metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (w > 0 && h > 0) {
      const opacity = Math.min(0.85, settings.vignette / 100)
      const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="v" cx="50%" cy="50%" r="75%">
            <stop offset="55%" stop-color="rgb(0,0,0)" stop-opacity="0"/>
            <stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="${opacity}"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#v)"/>
      </svg>`
      const overlay = await sharp(Buffer.from(svg)).resize(w, h).png().toBuffer()
      sharpInstance = sharpInstance.composite([{ input: overlay, blend: 'multiply' }])
    }
  }

  if (settings.grain != null && settings.grain > 0) {
    const meta = await sharpInstance.metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (w > 0 && h > 0) {
      const sigma = Math.max(1, settings.grain / 12)
      const noiseBuf = await sharp({
        create: {
          width: w,
          height: h,
          channels: 3,
          noise: { type: 'gaussian', mean: 128, sigma },
        },
      })
        .png()
        .toBuffer()
      sharpInstance = sharpInstance.composite([
        { input: noiseBuf, blend: 'overlay', opacity: Math.min(0.5, settings.grain / 200) },
      ])
    }
  }

  return sharpInstance
}

/**
 * 分析图片并返回建议的编辑参数（一键增强）。
 * 在 512px 缩略图上做通道统计，只推导「亮度 / 对比度 / 阴影 / 高光」这类可量化的项，
 * 锐化与降噪给固定保守值；参数区间刻意收窄，避免建议结果过冲。
 */
export async function analyzeForEdit(filePath: string): Promise<ImageEditSettings> {
  const fallback: ImageEditSettings = {
    brightness: 104,
    contrast: 104,
    saturation: 104,
    shadows: 6,
    highlights: -4,
    sharpen: 22,
    denoise: 12,
    clarity: 10,
  }

  try {
    const { displayPath } = await resolveStillPathForDisplay(filePath)
    const { channels } = await sharp(displayPath)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .stats()

    const [r, g, b] = channels
    if (!r || !g || !b) return fallback

    const mean = (r.mean + g.mean + b.mean) / 3
    const stdev = (r.stdev + g.stdev + b.stdev) / 3

    const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

    /** 以中灰 128 为目标做温和提亮/压暗 */
    const brightness = clampNum(Math.round(100 * Math.pow(126 / Math.max(12, mean), 0.3)), 92, 118)
    /** 低反差画面适度加对比，高反差不再叠加 */
    const contrast = clampNum(Math.round(100 + (52 - stdev) * 0.45), 96, 112)
    const shadows = mean < 108 ? clampNum(Math.round((108 - mean) * 0.35), 0, 18) : 0
    const highlights = mean > 138 ? clampNum(-Math.round((mean - 138) * 0.35), -16, 0) : 0
    /** 通道均值越接近，色彩越中性，可稍加饱和度 */
    const channelSpread = Math.max(r.mean, g.mean, b.mean) - Math.min(r.mean, g.mean, b.mean)
    const saturation = clampNum(Math.round(100 + (26 - channelSpread) * 0.35), 98, 112)

    return {
      brightness,
      contrast,
      saturation,
      exposure: 100,
      shadows,
      highlights,
      clarity: 10,
      sharpen: 22,
      denoise: stdev > 60 ? 16 : 10,
    }
  } catch (error) {
    console.warn('[analyzeForEdit] 统计失败，回退默认建议:', error)
    return fallback
  }
}

const PREVIEW_MAX_EDGE = 1280

/** 降采样预览，返回 data URL */
export async function previewEdits(
  filePath: string,
  settings: ImageEditSettings,
  maxEdge: number = PREVIEW_MAX_EDGE
): Promise<string> {
  const { displayPath } = await resolveStillPathForDisplay(filePath)
  let instance = sharp(displayPath)
  const meta = await instance.metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  if (w > 0 && h > 0) {
    const longest = Math.max(w, h)
    if (longest > maxEdge) {
      const scale = maxEdge / longest
      instance = instance.resize(Math.round(w * scale), Math.round(h * scale), {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
  }
  instance = await buildImageEditPipeline(instance, settings)
  const buffer = await instance.jpeg({ quality: 85, mozjpeg: true }).toBuffer()
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

function normalizeExportFormat(fmt: string): string {
  const f = fmt.toLowerCase()
  return f === 'jpg' ? 'jpeg' : f
}

function extensionForFormat(fmt: string): string {
  const n = normalizeExportFormat(fmt)
  if (n === 'jpeg') return '.jpg'
  if (n === 'tiff') return '.tif'
  return `.${n}`
}

function extensionsMatch(sourceExt: string, targetExt: string): boolean {
  const s = sourceExt.toLowerCase()
  const t = targetExt.toLowerCase()
  if (s === t) return true
  if ((s === '.jpg' || s === '.jpeg') && (t === '.jpg' || t === '.jpeg')) return true
  if ((s === '.tif' || s === '.tiff') && (t === '.tif' || t === '.tiff')) return true
  return false
}

/** 与同目录原图并排生成唯一文件名；默认 `{原名}_编辑_{日期时间}` */
async function generateUniqueEditedOutputPath(
  sourcePath: string,
  targetExt?: string
): Promise<string> {
  const path = await import('path')
  const fsExtra = await import('fs-extra')
  const dir = path.dirname(sourcePath)
  const ext = targetExt ?? path.extname(sourcePath)
  const stem = path.basename(sourcePath, path.extname(sourcePath))
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = new Date()
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  let candidate = path.join(dir, `${stem}_编辑_${stamp}${ext}`)
  let i = 1
  while (await fsExtra.pathExists(candidate)) {
    candidate = path.join(dir, `${stem}_编辑_${stamp}_${i}${ext}`)
    i += 1
  }
  return candidate
}

/** 将编辑结果写入磁盘；未指定 outputPath 时在同目录新建文件，不覆盖原图。返回实际写入路径。 */
export async function applyEdits(
  filePath: string,
  settings: ImageEditSettings,
  outputPath?: string
): Promise<string> {
  const targetPath = outputPath ?? (await generateUniqueEditedOutputPath(filePath))
  console.log('[imageUtils] applyEdits invoked', { filePath, targetPath, explicitOutput: !!outputPath, settings })

  let instance = sharp(filePath)
  instance = await buildImageEditPipeline(instance, settings)
  await instance.toFile(targetPath)
  return targetPath
}

const HISTOGRAM_MAX_EDGE = 512
const LARGE_IMAGE_PIXELS = 3840 * 2160

/** 主进程计算亮度直方图（大图 / 弱机 Canvas 回退） */
export async function getImageHistogram(filePath: string): Promise<LuminanceHistogramResult> {
  const empty: LuminanceHistogramResult = {
    bins: new Uint32Array(256),
    total: 0,
    peak: 0,
    clipShadow: 0,
    clipHighlight: 0,
  }
  try {
    const { displayPath } = await resolveStillPathForDisplay(filePath)
    const meta = await sharp(displayPath).metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (w <= 0 || h <= 0) return empty

    const scale = Math.min(1, HISTOGRAM_MAX_EDGE / Math.max(w, h))
    const cw = Math.max(1, Math.round(w * scale))
    const ch = Math.max(1, Math.round(h * scale))

    const { data, info } = await sharp(displayPath)
      .resize(cw, ch, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const channels = info.channels ?? 4
    const bins = new Uint32Array(256)
    const rBins = new Uint32Array(256)
    const gBins = new Uint32Array(256)
    const bBins = new Uint32Array(256)
    let total = 0
    let peak = 0

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      rBins[r] += 1
      gBins[g] += 1
      bBins[b] += 1
      const lum = Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b))
      bins[lum] += 1
      total += 1
      if (bins[lum] > peak) peak = bins[lum]
    }

    let shadowSum = 0
    let highlightSum = 0
    for (let j = 0; j <= 15; j++) shadowSum += bins[j]
    for (let j = 240; j < 256; j++) highlightSum += bins[j]

    return {
      bins,
      total,
      peak,
      clipShadow: total > 0 ? shadowSum / total : 0,
      clipHighlight: total > 0 ? highlightSum / total : 0,
      rgbBins: { r: rBins, g: gBins, b: bBins },
    }
  } catch (e) {
    console.error('[getImageHistogram] failed:', e)
    return empty
  }
}

export { LARGE_IMAGE_PIXELS }

const PREVIEW_EXPORT_MAX_EDGE = 1280

async function buildExportSharpInstance(
  filePath: string,
  options: FormatConversionOptions,
  maxEdge?: number
): Promise<sharp.Sharp> {
  const { displayPath } = await resolveStillPathForDisplay(filePath)
  let instance = sharp(displayPath)

  if (options.editSettings) {
    instance = await buildImageEditPipeline(instance, options.editSettings)
  }

  const metaBeforeResize = await instance.metadata()
  const rw = metaBeforeResize.width ?? 0
  const rh = metaBeforeResize.height ?? 0
  if (rw > 0 && rh > 0) {
    if (options.scalePercent != null && options.scalePercent > 0 && options.scalePercent < 100) {
      instance = instance.resize(
        Math.max(1, Math.round(rw * (options.scalePercent / 100))),
        Math.max(1, Math.round(rh * (options.scalePercent / 100))),
        { fit: 'inside', withoutEnlargement: true }
      )
    } else if (options.maxEdge != null && options.maxEdge > 0) {
      const longest = Math.max(rw, rh)
      if (longest > options.maxEdge) {
        const s = options.maxEdge / longest
        instance = instance.resize(Math.round(rw * s), Math.round(rh * s), {
          fit: 'inside',
          withoutEnlargement: true,
        })
      }
    } else if (maxEdge != null && maxEdge > 0) {
      const longest = Math.max(rw, rh)
      if (longest > maxEdge) {
        const s = maxEdge / longest
        instance = instance.resize(Math.round(rw * s), Math.round(rh * s), {
          fit: 'inside',
          withoutEnlargement: true,
        })
      }
    }
  }

  return instance
}

function applyExportEncoding(
  instance: sharp.Sharp,
  targetFormat: string,
  quality: number
): { pipeline: sharp.Sharp; mime: string } {
  const fmt = normalizeExportFormat(targetFormat)
  const q = Math.max(1, Math.min(quality || 80, 100))
  if (fmt === 'jpeg') {
    return { pipeline: instance.jpeg({ quality: q, mozjpeg: true }), mime: 'image/jpeg' }
  }
  if (fmt === 'png') {
    return { pipeline: instance.png({ quality: q }), mime: 'image/png' }
  }
  if (fmt === 'webp') {
    return { pipeline: instance.webp({ quality: q }), mime: 'image/webp' }
  }
  if (fmt === 'bmp') {
    return { pipeline: instance.bmp(), mime: 'image/bmp' }
  }
  if (fmt === 'tiff') {
    return { pipeline: instance.tiff({ quality: q }), mime: 'image/tiff' }
  }
  return { pipeline: instance.jpeg({ quality: q, mozjpeg: true }), mime: 'image/jpeg' }
}

async function resolveExportOutputPath(
  normalizedFilePath: string,
  options: FormatConversionOptions,
  targetFormat: string,
  explicitOutputPath?: string
): Promise<{ outputFilePath: string; deleteSourceAfterWrite: boolean }> {
  const path = await import('path')
  const fmt = normalizeExportFormat(targetFormat)
  const targetExt = extensionForFormat(fmt)
  const sourceExt = path.extname(normalizedFilePath)

  if (explicitOutputPath) {
    const fs = await import('fs')
    const normalizedOutputPath = path.normalize(explicitOutputPath)
    const fmtSlug = fmt === 'jpeg' ? 'jpg' : fmt === 'tiff' ? 'tif' : fmt
    if (fs.existsSync(normalizedOutputPath)) {
      const stats = fs.statSync(normalizedOutputPath)
      if (stats.isDirectory()) {
        const fileName = path.basename(normalizedFilePath, sourceExt)
        return {
          outputFilePath: path.join(normalizedOutputPath, `${fileName}-new.${fmtSlug}`),
          deleteSourceAfterWrite: false,
        }
      }
    }
    if (normalizedOutputPath !== normalizedFilePath) {
      return { outputFilePath: normalizedOutputPath, deleteSourceAfterWrite: false }
    }
    const fileName = path.basename(normalizedFilePath, sourceExt)
    const outputDir = path.dirname(normalizedFilePath)
    return {
      outputFilePath: path.join(outputDir, `${fileName}-new.${fmtSlug}`),
      deleteSourceAfterWrite: false,
    }
  }

  if (options.overwrite) {
    if (extensionsMatch(sourceExt, targetExt)) {
      return { outputFilePath: normalizedFilePath, deleteSourceAfterWrite: false }
    }
    const dir = path.dirname(normalizedFilePath)
    const stem = path.basename(normalizedFilePath, sourceExt)
    return {
      outputFilePath: path.join(dir, `${stem}${targetExt}`),
      deleteSourceAfterWrite: true,
    }
  }

  if (options.editSettings) {
    const outputFilePath = await generateUniqueEditedOutputPath(normalizedFilePath, targetExt)
    return { outputFilePath, deleteSourceAfterWrite: false }
  }

  const fileName = path.basename(normalizedFilePath, sourceExt)
  const outputDir = path.dirname(normalizedFilePath)
  return {
    outputFilePath: path.join(outputDir, `${fileName}-new.${fmt === 'jpeg' ? 'jpg' : fmt === 'tiff' ? 'tif' : fmt}`),
    deleteSourceAfterWrite: false,
  }
}

async function writeSharpToPath(
  instance: sharp.Sharp,
  outputFilePath: string,
  overwriteInPlace: boolean
): Promise<void> {
  const path = await import('path')
  const fs = await import('fs')
  const fsExtra = await import('fs-extra')
  const os = await import('os')
  const { randomUUID } = await import('crypto')

  const outputDir = path.dirname(outputFilePath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  if (overwriteInPlace) {
    const tmpPath = path.join(os.tmpdir(), `filedeal-export-${randomUUID()}${path.extname(outputFilePath)}`)
    try {
      await instance.toFile(tmpPath)
      await fsExtra.move(tmpPath, outputFilePath, { overwrite: true })
    } catch (err) {
      try {
        if (fsExtra.existsSync(tmpPath)) await fsExtra.unlink(tmpPath)
      } catch (_e) {
        /* ignore */
      }
      throw err
    }
    return
  }

  await instance.toFile(outputFilePath)
}

/** 降采样导出预览：应用编辑 + 目标格式/质量，返回 data URL 与体积 */
export async function previewExport(
  filePath: string,
  options: FormatConversionOptions,
  maxEdge: number = PREVIEW_EXPORT_MAX_EDGE
): Promise<ExportPreviewResult> {
  let instance = await buildExportSharpInstance(filePath, options, maxEdge)
  const { pipeline, mime } = applyExportEncoding(instance, options.targetFormat, options.quality ?? 80)
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })
  const base64 = data.toString('base64')
  return {
    dataUrl: `data:${mime};base64,${base64}`,
    byteSize: data.length,
    width: info.width ?? 0,
    height: info.height ?? 0,
  }
}

export async function convertFormat(
  filePath: string,
  options: FormatConversionOptions,
  outputPath?: string
): Promise<string> {
  try {
    const path = await import('path')
    const fsExtra = await import('fs-extra')
    const normalizedFilePath = path.normalize(filePath)
    const fmt = normalizeExportFormat(options.targetFormat)

    let instance = await buildExportSharpInstance(filePath, options)
    const { pipeline } = applyExportEncoding(instance, options.targetFormat, options.quality ?? 80)

    const { outputFilePath, deleteSourceAfterWrite } = await resolveExportOutputPath(
      normalizedFilePath,
      options,
      fmt,
      outputPath
    )

    const overwriteInPlace =
      !!options.overwrite && outputFilePath === normalizedFilePath

    await writeSharpToPath(pipeline, outputFilePath, overwriteInPlace)

    if (options.watermark) {
      const { previewWatermark } = await import('../services/imageToolService')
      const dataUrl = await previewWatermark(outputFilePath, options.watermark)
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      await sharp(Buffer.from(base64, 'base64')).toFile(outputFilePath)
    }

    if (deleteSourceAfterWrite && normalizedFilePath !== outputFilePath) {
      try {
        if (await fsExtra.pathExists(normalizedFilePath)) {
          await fsExtra.unlink(normalizedFilePath)
        }
      } catch (e) {
        console.warn('[convertFormat] 删除原文件失败:', normalizedFilePath, e)
      }
    }

    return outputFilePath
  } catch (error) {
    console.error(`[convertFormat] 转换失败:`, error)
    console.error(`[convertFormat] 失败文件:`, filePath)
    throw error
  }
}

export async function compressImage(filePath: string, options: CompressionOptions, outputPath?: string): Promise<void> {
  const mimeType = getMimeType(filePath)
  let instance = sharp(filePath)
  const quality = Math.max(Math.min(options.qualityPercentage || 80, 100), 1)
  if (mimeType === 'image/png') {
    instance = instance.png({ quality })
  } else if (mimeType === 'image/webp') {
    instance = instance.webp({ quality })
  } else {
    instance = instance.jpeg({ quality })
  }
  
  if (outputPath) {
    await instance.toFile(outputPath)
    return
  }

  const path = await import('path')
  const os = await import('os')
  const { randomUUID } = await import('crypto')
  const fsExtra = await import('fs-extra')
  /** 中间文件写到系统临时目录，避免在图片同目录出现「xxx.tmp」残留 */
  const tmpPath = path.join(os.tmpdir(), `filedeal-compress-${randomUUID()}${path.extname(filePath)}`)

  try {
    await instance.toFile(tmpPath)
    const maxAttempts = 3
    let attempt = 0
    while (true) {
      try {
        await fsExtra.move(tmpPath, filePath, { overwrite: true })
        break
      } catch (moveErr: any) {
        attempt += 1
        console.warn('[imageUtils] compress move attempt', attempt, 'failed', moveErr.code)
        if ((moveErr.code === 'EPERM' || moveErr.code === 'EACCES') && attempt < maxAttempts) {
          await new Promise(res => setTimeout(res, 100))
          continue
        }
        throw moveErr
      }
    }
  } catch (err: any) {
    try {
      if (fsExtra.existsSync(tmpPath)) {
        await fsExtra.unlink(tmpPath)
      }
    } catch (_e) {}

    if (err.code === 'EPERM' || err.code === 'EACCES') {
      throw new Error('文件被占用或权限不足，无法保存')
    }
    throw err
  }
}

export async function estimateCompressedSize(filePath: string, options: CompressionOptions): Promise<number> {
  const mimeType = getMimeType(filePath)
  let instance = sharp(filePath)
  const quality = Math.max(Math.min(options.qualityPercentage || 80, 100), 1)
  if (mimeType === 'image/png') {
    instance = instance.png({ quality })
  } else if (mimeType === 'image/webp') {
    instance = instance.webp({ quality })
  } else {
    instance = instance.jpeg({ quality })
  }
  const buffer = await instance.toBuffer()
  return buffer.length
}
