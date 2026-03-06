import sharp from 'sharp'
import { join, dirname, basename, extname } from 'path'
import { existsSync, mkdirSync, renameSync, copyFileSync, unlinkSync, readdirSync } from 'fs'
import type { BatchRenameOptions, RenameResult, WatermarkOptions, StitchOptions, GifFrame, GifOptions, PdfOptions, ThumbnailOptions, ThumbnailResult, EnhanceOptions } from '../../src/types'

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

function getOutputPath(originalPath: string, outputDir: string, newName: string): string {
  return join(outputDir, newName)
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function generateUniquePath(filePath: string): string {
  if (!existsSync(filePath)) return filePath
  
  const dir = dirname(filePath)
  const ext = extname(filePath)
  const base = basename(filePath, ext)
  
  let counter = 1
  let newPath = filePath
  while (existsSync(newPath)) {
    newPath = join(dir, `${base}_${counter}${ext}`)
    counter++
  }
  return newPath
}

export async function batchRename(files: string[], options: BatchRenameOptions): Promise<RenameResult[]> {
  const results: RenameResult[] = []
  
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]
    try {
      const fileName = basename(filePath)
      const ext = extname(fileName)
      const baseName = ext ? fileName.slice(0, -ext.length) : fileName
      let newName = baseName

      switch (options.mode) {
        case 'sequence': {
          const num = ((options.sequenceStart || 1) + i).toString().padStart(options.sequencePadding || 3, '0')
          newName = `${num}${ext}`
          break
        }
        case 'date': {
          const now = new Date()
          const dateStr = (options.dateFormat || 'YYYY-MM-DD')
            .replace('YYYY', now.getFullYear().toString())
            .replace('MM', (now.getMonth() + 1).toString().padStart(2, '0'))
            .replace('DD', now.getDate().toString().padStart(2, '0'))
          newName = `${dateStr}_${baseName}${ext}`
          break
        }
        case 'replace': {
          if (options.findText) {
            const flags = options.caseSensitive ? 'g' : 'gi'
            const regex = new RegExp(options.findText, flags)
            newName = baseName.replace(regex, options.replaceText || '') + ext
          } else {
            newName = baseName + ext
          }
          break
        }
        case 'prefix': {
          newName = (options.prefix || '') + baseName + ext
          break
        }
        case 'suffix': {
          newName = baseName + (options.suffix || '') + ext
          break
        }
      }

      const outputDir = options.outputPath || dirname(filePath)
      ensureDir(outputDir)
      let newPath = join(outputDir, newName)

      if (existsSync(newPath) && newPath !== filePath) {
        switch (options.conflictAction) {
          case 'skip':
            results.push({ originalPath: filePath, newPath, success: false, error: '文件已存在，跳过' })
            continue
          case 'overwrite':
            break
          case 'rename':
          default:
            newPath = generateUniquePath(newPath)
            break
        }
      }

      if (options.outputPath) {
        copyFileSync(filePath, newPath)
      } else {
        renameSync(filePath, newPath)
      }

      results.push({ originalPath: filePath, newPath, success: true })
    } catch (error: any) {
      results.push({ originalPath: filePath, newPath: '', success: false, error: error.message })
    }
  }

  return results
}

export async function addWatermark(files: string[], options: WatermarkOptions): Promise<{ filePath: string; success: boolean; error?: string }[]> {
  const results: { filePath: string; success: boolean; error?: string }[] = []

  for (const filePath of files) {
    try {
      const dir = dirname(filePath)
      const ext = extname(filePath)
      const base = basename(filePath, ext)
      const outputPath = join(dir, `${base}_watermarked${ext}`)

      let sharpInstance = sharp(filePath)
      const metadata = await sharpInstance.metadata()
      const width = metadata.width || 800
      const height = metadata.height || 600

      let watermarkSvg: Buffer

      if (options.type === 'text' && options.text) {
        const { content, fontSize, color, opacity } = options.text
        const svgWidth = Math.max(width * 0.3, 200)
        const svgHeight = fontSize * 1.5
        
        watermarkSvg = Buffer.from(`
          <svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
            <text 
              x="50%" 
              y="50%" 
              font-family="Arial" 
              font-size="${fontSize}" 
              fill="${color}" 
              fill-opacity="${opacity}"
              text-anchor="middle" 
              dominant-baseline="middle"
            >${content}</text>
          </svg>
        `)
      } else {
        continue
      }

      const position = options.position || 'bottom-right'
      const margin = options.margin || 20

      let gravity: string
      switch (position) {
        case 'top-left': gravity = 'northwest'; break
        case 'top-center': gravity = 'north'; break
        case 'top-right': gravity = 'northeast'; break
        case 'middle-left': gravity = 'west'; break
        case 'middle-center': gravity = 'center'; break
        case 'middle-right': gravity = 'east'; break
        case 'bottom-left': gravity = 'southwest'; break
        case 'bottom-center': gravity = 'south'; break
        case 'bottom-right': gravity = 'southeast'; break
        default: gravity = 'southeast'
      }

      if (options.tile) {
        const tilesX = Math.ceil(width / (width * 0.3 + margin))
        const tilesY = Math.ceil(height / (100 + margin))
        
        let compositeOps: any[] = []
        for (let x = 0; x < tilesX; x++) {
          for (let y = 0; y < tilesY; y++) {
            compositeOps.push({
              input: watermarkSvg,
              left: x * (width * 0.3 + margin) + margin,
              top: y * 100 + margin
            })
          }
        }
        sharpInstance = sharpInstance.composite(compositeOps)
      } else {
        const gravityMap: Record<string, string> = {
          'northwest': 'NW', 'north': 'N', 'northeast': 'NE',
          'west': 'W', 'center': 'C', 'east': 'E',
          'southwest': 'SW', 'south': 'S', 'southeast': 'SE'
        }
        
        sharpInstance = sharpInstance.composite([{
          input: watermarkSvg,
          gravity: gravityMap[gravity] || 'SE'
        }])
      }

      await sharpInstance.toFile(outputPath)
      results.push({ filePath, success: true })
    } catch (error: any) {
      results.push({ filePath, success: false, error: error.message })
    }
  }

  return results
}

export async function stitchImages(images: string[], options: StitchOptions): Promise<string> {
  const imageBuffers = await Promise.all(
    images.map(async (imgPath) => {
      const buffer = await sharp(imgPath).toBuffer()
      const metadata = await sharp(buffer).metadata()
      return { buffer, width: metadata.width || 0, height: metadata.height || 0 }
    })
  )

  let totalWidth = 0
  let totalHeight = 0
  const { mode, gap = 0, backgroundColor = '#ffffff', rows, cols, align } = options

  if (mode === 'horizontal') {
    const maxHeight = Math.max(...imageBuffers.map(img => img.height))
    totalWidth = imageBuffers.reduce((sum, img) => sum + img.width, 0) + gap * (imageBuffers.length - 1)
    totalHeight = maxHeight
  } else if (mode === 'vertical') {
    const maxWidth = Math.max(...imageBuffers.map(img => img.width))
    totalHeight = imageBuffers.reduce((sum, img) => sum + img.height, 0) + gap * (imageBuffers.length - 1)
    totalWidth = maxWidth
  } else {
    const r = rows || 2
    const c = cols || 2
    const maxW = Math.max(...imageBuffers.map(img => img.width))
    const maxH = Math.max(...imageBuffers.map(img => img.height))
    totalWidth = c * maxW + gap * (c - 1)
    totalHeight = r * maxH + gap * (r - 1)
  }

  let compositeOps: any[] = []
  let currentX = 0
  let currentY = 0

  if (mode === 'horizontal') {
    const maxHeight = Math.max(...imageBuffers.map(img => img.height))
    for (const img of imageBuffers) {
      const yOffset = align === 'start' ? 0 : align === 'end' ? maxHeight - img.height : (maxHeight - img.height) / 2
      compositeOps.push({
        input: img.buffer,
        left: currentX,
        top: yOffset
      })
      currentX += img.width + gap
    }
  } else if (mode === 'vertical') {
    const maxWidth = Math.max(...imageBuffers.map(img => img.width))
    for (const img of imageBuffers) {
      const xOffset = align === 'start' ? 0 : align === 'end' ? maxWidth - img.width : (maxWidth - img.width) / 2
      compositeOps.push({
        input: img.buffer,
        left: xOffset,
        top: currentY
      })
      currentY += img.height + gap
    }
  } else {
    const r = rows || 2
    const c = cols || 2
    const maxW = Math.max(...imageBuffers.map(img => img.width))
    const maxH = Math.max(...imageBuffers.map(img => img.height))
    
    for (let i = 0; i < Math.min(images.length, r * c); i++) {
      const row = Math.floor(i / c)
      const col = i % c
      
      let xOffset = col * (maxW + gap)
      let yOffset = row * (maxH + gap)
      
      if (align === 'center' || align === 'end') {
        const img = imageBuffers[i]
        if (align === 'center') {
          xOffset += (maxW - img.width) / 2
          yOffset += (maxH - img.height) / 2
        } else {
          xOffset += maxW - img.width
          yOffset += maxH - img.height
        }
      }
      
      compositeOps.push({
        input: imageBuffers[i].buffer,
        left: xOffset,
        top: yOffset
      })
    }
  }

  const outputFormat = options.outputFormat || 'jpeg'
  const outputPath = join(dirname(images[0]), `stitched_${Date.now()}.${outputFormat}`)

  await sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: backgroundColor
    }
  })
    .composite(compositeOps)
    .toFormat(outputFormat, { quality: options.quality || 90 })
    .toFile(outputPath)

  return outputPath
}

export async function createGif(frames: GifFrame[], options: GifOptions): Promise<string> {
  const frameBuffers = await Promise.all(
    frames.map(async (frame) => {
      let img = sharp(frame.imagePath)
      
      if (options.width || options.height) {
        img = img.resize(options.width, options.height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      }
      
      return img.toBuffer()
    })
  )

  const outputPath = join(options.outputPath || dirname(frames[0].imagePath), `animated_${Date.now()}.gif`)

  const sharpGifs = await Promise.all(
    frameBuffers.map(buffer => sharp(buffer).gif())
  )

  const { default: gifencoder } = await import('gifencoder')
  const encoder = gifencoder(800, 600)
  
  const { createWriteStream } = await import('fs')
  const stream = createWriteStream(outputPath)
  encoder.createReadStream().pipe(stream)

  encoder.start()
  encoder.setRepeat(options.loop || 0)
  encoder.setDelay(options.delay || 200)
  encoder.setQuality(options.quality || 10)

  for (const buffer of frameBuffers) {
    const { data, info } = await sharp(buffer)
      .resize(800, 600, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    
    encoder.addFrame(data)
  }

  encoder.finish()

  return new Promise((resolve) => {
    stream.on('finish', () => resolve(outputPath))
  })
}

export async function imagesToPdf(images: string[], options: PdfOptions): Promise<string> {
  const { pageSize = 'a4', orientation = 'auto', margin = 10, imagesPerPage = 'auto', outputPath: outDir } = options

  const pageSizes: Record<string, { width: number; height: number }> = {
    a4: { width: 595, height: 842 },
    a3: { width: 842, height: 1191 },
    letter: { width: 612, height: 792 }
  }

  const pdfkit = (await import('pdfkit')).default
  const { createWriteStream } = await import('fs')

  const outputFile = join(outDir || dirname(images[0]), `combined_${Date.now()}.pdf`)
  const doc = new pdfkit({ size: pageSizes[pageSize] || 'A4', margin: margin })

  doc.pipe(createWriteStream(outputFile))

  for (let i = 0; i < images.length; i++) {
    if (i > 0) {
      doc.addPage()
    }

    const metadata = await sharp(images[i]).metadata()
    const imgWidth = metadata.width || 800
    const imgHeight = metadata.height || 600

    let pageWidth = doc.page.width - margin * 2
    let pageHeight = doc.page.height - margin * 2

    let finalWidth = imgWidth
    let finalHeight = imgHeight

    if (orientation === 'portrait' || (orientation === 'auto' && imgHeight > imgWidth)) {
      if (finalWidth > pageWidth) {
        finalHeight = (pageWidth / finalWidth) * finalHeight
        finalWidth = pageWidth
      }
      if (finalHeight > pageHeight) {
        finalWidth = (pageHeight / finalHeight) * finalWidth
        finalHeight = pageHeight
      }
    } else {
      const temp = pageWidth
      pageWidth = pageHeight
      pageHeight = temp

      if (finalWidth > pageWidth) {
        finalHeight = (pageWidth / finalWidth) * finalHeight
        finalWidth = pageWidth
      }
      if (finalHeight > pageHeight) {
        finalWidth = (pageHeight / finalHeight) * finalWidth
        finalHeight = pageHeight
      }
    }

    const x = (doc.page.width - finalWidth) / 2
    const y = (doc.page.height - finalHeight) / 2

    doc.image(images[i], x, y, { width: finalWidth, height: finalHeight })
  }

  doc.end()

  return new Promise((resolve) => {
    doc.on('end', () => resolve(outputFile))
  })
}

export async function generateThumbnails(files: string[], options: ThumbnailOptions): Promise<ThumbnailResult[]> {
  const results: ThumbnailResult[] = []

  for (const filePath of files) {
    try {
      const dir = dirname(filePath)
      const ext = extname(filePath)
      const base = basename(filePath, ext)
      
      let newName: string
      switch (options.naming) {
        case 'prefix':
          newName = (options.prefix || 'thumb_') + base + ext
          break
        case 'suffix':
          newName = base + (options.suffix || '_thumb') + ext
          break
        case 'custom':
          newName = (options.customName || 'thumb') + ext
          break
        default:
          newName = base + '_thumb' + ext
      }

      const outputDir = options.outputDir === 'custom' ? options.outputDir : dir
      const outputPath = join(outputDir, newName)

      let sharpInstance = sharp(filePath).resize(options.width, options.height, {
        fit: options.fit || 'cover',
        position: 'center'
      })

      if (options.format === 'jpeg') {
        sharpInstance = sharpInstance.jpeg({ quality: options.quality || 80 })
      } else if (options.format === 'png') {
        sharpInstance = sharpInstance.png({ quality: options.quality || 80 })
      } else if (options.format === 'webp') {
        sharpInstance = sharpInstance.webp({ quality: options.quality || 80 })
      }

      await sharpInstance.toFile(outputPath)

      results.push({ originalPath: filePath, thumbnailPath: outputPath, success: true })
    } catch (error: any) {
      results.push({ originalPath: filePath, thumbnailPath: '', success: false, error: error.message })
    }
  }

  return results
}

export async function enhanceImage(file: string, options: EnhanceOptions): Promise<string> {
  const dir = dirname(file)
  const ext = extname(file)
  const base = basename(file, ext)
  const outputPath = join(options.outputPath || dir, `${base}_enhanced${ext}`)

  let sharpInstance = sharp(file)

  if (options.mode === 'auto' && options.auto) {
    sharpInstance = sharpInstance.modulate({ brightness: 1.1, saturation: 1.1 })
    
    if (options.auto.sharpen) {
      sharpInstance = sharpInstance.sharpen(1, 1, 0)
    }
    
    if (options.auto.denoise) {
      sharpInstance = sharpInstance.blur(0.5)
    }
  } else if (options.mode === 'manual' && options.manual) {
    const { brightness = 0, contrast = 0, saturation = 0, sharpness = 0 } = options.manual
    
    const brightnessFactor = 1 + brightness / 100
    const saturationFactor = 1 + saturation / 100
    
    sharpInstance = sharpInstance.modulate({ brightness: brightnessFactor, saturation: saturationFactor })
    
    if (contrast !== 0) {
      const factor = 1 + contrast / 100
      sharpInstance = sharpInstance.linear(factor, -(128 * (factor - 1)))
    }
    
    if (sharpness > 0) {
      sharpInstance = sharpInstance.sharpen(sharpness / 50, 1, 0)
    }
  }

  if (options.scale && options.scale > 1) {
    const metadata = await sharpInstance.metadata()
    const newWidth = Math.round((metadata.width || 800) * options.scale)
    const newHeight = Math.round((metadata.height || 600) * options.scale)
    sharpInstance = sharpInstance.resize(newWidth, newHeight, { kernel: 'lanczos3' })
  }

  await sharpInstance.toFile(outputPath)

  return outputPath
}
