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

/** 与同目录原图并排生成唯一文件名，保留扩展名；默认 `{原名}_编辑_{日期时间}` */
async function generateUniqueEditedOutputPath(sourcePath: string): Promise<string> {
  const path = await import('path')
  const fsExtra = await import('fs-extra')
  const dir = path.dirname(sourcePath)
  const ext = path.extname(sourcePath)
  const stem = path.basename(sourcePath, ext)
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
  instance = await applySharpSettings(instance, settings)
  await instance.toFile(targetPath)
  return targetPath
}

export async function convertFormat(filePath: string, options: FormatConversionOptions, outputPath?: string): Promise<void> {
  try {
    console.log(`[convertFormat] 开始转换: ${filePath}`)
    console.log(`[convertFormat] 选项:`, options)
    console.log(`[convertFormat] 输出路径:`, outputPath)
    
    // 规范化路径，确保在Windows和Linux上都能正常工作
    const fs = await import('fs')
    const path = await import('path')
    const normalizedFilePath = path.normalize(filePath)
    const normalizedOutputPath = outputPath ? path.normalize(outputPath) : undefined
    
    console.log(`[convertFormat] 规范化后输入路径:`, normalizedFilePath)
    console.log(`[convertFormat] 规范化后输出路径:`, normalizedOutputPath)
    
    let instance = sharp(normalizedFilePath)
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
    
    let outputFilePath: string
    
    if (normalizedOutputPath) {
      // 确保输出目录存在
      let outputDir: string
      if (fs.existsSync(normalizedOutputPath)) {
        const stats = fs.statSync(normalizedOutputPath)
        if (stats.isDirectory()) {
          outputDir = normalizedOutputPath
          const fileName = path.basename(normalizedFilePath, path.extname(normalizedFilePath))
          outputFilePath = path.join(outputDir, `${fileName}-new.${fmt}`)
        } else {
          // 如果是文件，且与输入文件不同，则使用该文件
          if (normalizedOutputPath !== normalizedFilePath) {
            outputFilePath = normalizedOutputPath
            // 确保输出文件的目录存在
            outputDir = path.dirname(normalizedOutputPath)
          } else {
            // 如果输出文件与输入文件相同，生成带"-new"后缀的文件名
            const fileName = path.basename(normalizedFilePath, path.extname(normalizedFilePath))
            outputDir = path.dirname(normalizedFilePath)
            outputFilePath = path.join(outputDir, `${fileName}-new.${fmt}`)
          }
        }
      } else {
        // 如果outputPath不存在，假设它是目录
        outputDir = normalizedOutputPath
        const fileName = path.basename(normalizedFilePath, path.extname(normalizedFilePath))
        outputFilePath = path.join(outputDir, `${fileName}-new.${fmt}`)
      }
      
      // 确保输出目录存在
      if (!fs.existsSync(outputDir)) {
        console.log(`[convertFormat] 创建输出目录:`, outputDir)
        fs.mkdirSync(outputDir, { recursive: true })
      }
    } else {
      // 如果没有outputPath，在原目录生成带"-new"后缀的文件名
      const fileName = path.basename(normalizedFilePath, path.extname(normalizedFilePath))
      const outputDir = path.dirname(normalizedFilePath)
      outputFilePath = path.join(outputDir, `${fileName}-new.${fmt}`)
    }
    
    console.log(`[convertFormat] 最终输出路径:`, outputFilePath)
    
    // 确保输出路径与输入路径不同
    if (outputFilePath === normalizedFilePath) {
      // 如果仍然相同，强制添加"-new"后缀
      const fileName = path.basename(normalizedFilePath, path.extname(normalizedFilePath))
      const outputDir = path.dirname(normalizedFilePath)
      outputFilePath = path.join(outputDir, `${fileName}-new.${fmt}`)
      console.log(`[convertFormat] 输出路径与输入路径相同，强制添加后缀:`, outputFilePath)
    }
    
    await instance.toFile(outputFilePath)
    console.log(`[convertFormat] 转换成功:`, outputFilePath)
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
