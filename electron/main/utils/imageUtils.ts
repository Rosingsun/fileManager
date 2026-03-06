import sharp from 'sharp'
import { getMimeType } from './fileUtils'

export async function getImageDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const metadata = await sharp(filePath).metadata()
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
    
    const mimeType = getMimeType(filePath)
    const isPng = mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/jpg'
    const isWebp = mimeType === 'image/webp'
    const isGif = mimeType === 'image/gif'
    const isBmp = mimeType === 'image/bmp'
    const isSvg = mimeType === 'image/svg+xml'
    
    const effectiveQuality = Math.max(Math.min(quality || 60, 100), 1)
    const sharpInstance = sharp(filePath)
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

export async function getImageBase64(filePath: string): Promise<string> {
  try {
    const buffer = await import('fs').then(fs => fs.promises.readFile(filePath))
    const mimeType = getMimeType(filePath)
    const base64 = buffer.toString('base64')
    return `data:${mimeType};base64,${base64}`
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
import type { ImageEditSettings, FormatConversionOptions, CompressionOptions } from '../../src/types'

async function applySharpSettings(sharpInstance: any, settings: ImageEditSettings) {
  // 基础色彩调整
  if (settings.brightness != null || settings.contrast != null || settings.saturation != null || settings.hue != null) {
    const brightness = settings.brightness != null ? settings.brightness / 100 : 1
    const saturation = settings.saturation != null ? settings.saturation / 100 : 1
    const hue = settings.hue != null ? settings.hue : 0
    sharpInstance = sharpInstance.modulate({ brightness, saturation, hue })
  }
  
  // 对比度调整
  if (settings.contrast != null) {
    const factor = settings.contrast / 100
    sharpInstance = sharpInstance.linear(factor, -(128 * (factor - 1)))
  }
  
  // 曝光调整
  if (settings.exposure != null) {
    const exposure = settings.exposure / 100
    sharpInstance = sharpInstance.modulate({ brightness: exposure })
  }
  
  // 滤镜效果
  if (settings.grayscale) {
    sharpInstance = sharpInstance.grayscale()
  }
  
  if (settings.blur != null && settings.blur > 0) {
    sharpInstance = sharpInstance.blur(settings.blur)
  }
  
  if (settings.sharpen != null && settings.sharpen > 0) {
    const sigma = Math.max(settings.sharpen / 50, 0.3)
    sharpInstance = sharpInstance.sharpen(sigma, 1, 0)
  }
  
  if (settings.vintage != null && settings.vintage > 0) {
    const sepiaAmount = settings.vintage / 100
    sharpInstance = sharpInstance.recomb([
      [0.393 + 0.607 * (1 - sepiaAmount), 0.769 - 0.769 * (1 - sepiaAmount), 0.189 - 0.189 * (1 - sepiaAmount)],
      [0.349 - 0.349 * (1 - sepiaAmount), 0.686 + 0.314 * (1 - sepiaAmount), 0.168 - 0.168 * (1 - sepiaAmount)],
      [0.272 - 0.272 * (1 - sepiaAmount), 0.534 - 0.534 * (1 - sepiaAmount), 0.131 + 0.869 * (1 - sepiaAmount)]
    ])
  }
  
  // 高级调整 - 阴影
  if (settings.shadows != null && settings.shadows !== 0) {
    const shadowFactor = 1 + settings.shadows / 200
    sharpInstance = sharpInstance.modulate({ brightness: shadowFactor })
  }
  
  // 高级调整 - 清晰度（通过局部对比度增强）
  if (settings.clarity != null && settings.clarity !== 0) {
    const clarityFactor = 1 + settings.clarity / 200
    sharpInstance = sharpInstance.linear(clarityFactor, -(128 * (clarityFactor - 1)))
  }
  
  // 变换操作
  if (settings.rotation) {
    sharpInstance = sharpInstance.rotate(settings.rotation)
  }
  if (settings.flipHorizontal) {
    sharpInstance = sharpInstance.flip()
  }
  if (settings.flipVertical) {
    sharpInstance = sharpInstance.flop()
  }
  
  // 裁剪
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

export async function applyEdits(filePath: string, settings: ImageEditSettings, outputPath?: string): Promise<void> {
  let instance = sharp(filePath)
  instance = await applySharpSettings(instance, settings)
  if (outputPath) {
    await instance.toFile(outputPath)
  } else {
    await instance.toFile(filePath)
  }
}

export async function convertFormat(filePath: string, options: FormatConversionOptions, outputPath?: string): Promise<void> {
  let instance = sharp(filePath)
  const fmt = options.targetFormat.toLowerCase()
  if (fmt === 'jpeg' || fmt === 'jpg') {
    instance = instance.jpeg({ quality: options.quality || 80 })
  } else if (fmt === 'png') {
    instance = instance.png({ quality: options.quality || 80 })
  } else if (fmt === 'webp') {
    instance = instance.webp({ quality: options.quality || 80 })
  } else if (fmt === 'bmp') {
    instance = instance.bmp()
  } else if (fmt === 'tiff' || fmt === 'tif') {
    instance = instance.tiff({ quality: options.quality || 80 })
  }
  if (outputPath) {
    await instance.toFile(outputPath)
  } else {
    await instance.toFile(filePath)
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
  } else {
    await instance.toFile(filePath)
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
