import fs from 'fs-extra'
import sharp from 'sharp'

const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073]
const CLIP_STD = [0.26862954, 0.26130258, 0.27577711]
const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_STD = [0.229, 0.224, 0.225]

export interface CropSpec {
  left: number
  top: number
  width: number
  height: number
}

/** 根据裁剪数量生成 crop 规格（相对原图比例坐标，由调用方换算） */
export function buildCropSpecs(cropCount: number): Array<{ x: number; y: number; size: number }> {
  if (cropCount <= 1) return [{ x: 0.5, y: 0.5, size: 1 }]
  if (cropCount === 3) {
    return [
      { x: 0.5, y: 0.5, size: 1 },
      { x: 0.35, y: 0.5, size: 0.88 },
      { x: 0.65, y: 0.5, size: 0.88 }
    ]
  }
  return [
    { x: 0.5, y: 0.5, size: 1 },
    { x: 0.35, y: 0.35, size: 0.85 },
    { x: 0.65, y: 0.35, size: 0.85 },
    { x: 0.35, y: 0.65, size: 0.85 },
    { x: 0.65, y: 0.65, size: 0.85 }
  ]
}

function normalizePixels(
  resized: Buffer,
  inputSize: number,
  mode: 'clip' | 'imagenet'
): Float32Array {
  const mean = mode === 'clip' ? CLIP_MEAN : IMAGENET_MEAN
  const std = mode === 'clip' ? CLIP_STD : IMAGENET_STD
  const pixels = new Float32Array(3 * inputSize * inputSize)
  const hw = inputSize * inputSize

  for (let i = 0; i < resized.length && i + 2 < resized.length; i += 3) {
    const idx = Math.floor(i / 3)
    const r = resized[i] / 255.0
    const g = resized[i + 1] / 255.0
    const b = resized[i + 2] / 255.0
    pixels[idx] = (r - mean[0]) / std[0]
    pixels[hw + idx] = (g - mean[1]) / std[1]
    pixels[2 * hw + idx] = (b - mean[2]) / std[2]
  }

  return pixels
}

async function extractAndLetterbox(
  imageBuffer: Buffer,
  inputSize: number,
  mode: 'clip' | 'imagenet',
  crop?: { x: number; y: number; size: number }
): Promise<Float32Array> {
  let pipeline = sharp(imageBuffer).rotate()

  if (crop && crop.size < 1) {
    const meta = await sharp(imageBuffer).rotate().metadata()
    const w = meta.width ?? inputSize
    const h = meta.height ?? inputSize
    const cropSize = Math.round(Math.min(w, h) * crop.size)
    const left = Math.max(0, Math.min(w - cropSize, Math.round(w * crop.x - cropSize / 2)))
    const top = Math.max(0, Math.min(h - cropSize, Math.round(h * crop.y - cropSize / 2)))
    pipeline = sharp(imageBuffer).rotate().extract({ left, top, width: cropSize, height: cropSize })
  }

  const resized = await pipeline
    .resize(inputSize, inputSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    })
    .ensureAlpha()
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .raw()
    .toBuffer()

  return normalizePixels(resized, inputSize, mode)
}

/**
 * EXIF 转正 + letterbox 到正方形 + NCHW float32（CLIP 或 ImageNet 归一化）
 */
export async function preprocessLetterbox(
  imagePath: string,
  inputSize: number,
  mode: 'clip' | 'imagenet'
): Promise<Float32Array> {
  const imageBuffer = await fs.readFile(imagePath)
  return extractAndLetterbox(imageBuffer, inputSize, mode)
}

/**
 * 多裁剪 TTA：返回各裁剪的 NCHW float32 张量
 */
export async function preprocessMultiCrop(
  imagePath: string,
  inputSize: number,
  mode: 'clip' | 'imagenet',
  cropCount = 1
): Promise<Float32Array[]> {
  const imageBuffer = await fs.readFile(imagePath)
  const specs = buildCropSpecs(cropCount)
  const results: Float32Array[] = []
  for (const spec of specs) {
    results.push(await extractAndLetterbox(imageBuffer, inputSize, mode, spec))
  }
  return results
}
