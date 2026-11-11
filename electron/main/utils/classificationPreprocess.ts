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

/** 根据裁剪数量生成 crop 规格（相对原图比例坐标） */
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * raw 像素 → NCHW float32。按 sharp 报告的实际通道数取步长，
 * 避免把 RGBA 当 RGB 解析造成通道/像素错位。
 */
function normalizePixels(
  raw: Buffer,
  inputSize: number,
  mode: 'clip' | 'imagenet',
  channels: number
): Float32Array {
  const mean = mode === 'clip' ? CLIP_MEAN : IMAGENET_MEAN
  const std = mode === 'clip' ? CLIP_STD : IMAGENET_STD
  const pixels = new Float32Array(3 * inputSize * inputSize)
  const hw = inputSize * inputSize
  const step = Math.max(3, channels)
  for (let i = 0, idx = 0; i + 2 < raw.length && idx < hw; i += step, idx++) {
    pixels[idx] = (raw[i] / 255 - mean[0]) / std[0]
    pixels[hw + idx] = (raw[i + 1] / 255 - mean[1]) / std[1]
    pixels[2 * hw + idx] = (raw[i + 2] / 255 - mean[2]) / std[2]
  }
  return pixels
}

/**
 * EXIF 转正 → 短边等比缩放 → 中心裁剪（可偏移做 TTA）→ 3 通道 NCHW 归一化。
 * 对齐 CLIP 官方 Resize(短边) + CenterCrop 预处理，不产生 letterbox 黑边。
 */
async function extractAndNormalize(
  imageBuffer: Buffer,
  inputSize: number,
  mode: 'clip' | 'imagenet',
  crop?: { x: number; y: number; size: number }
): Promise<Float32Array> {
  const size = crop?.size ?? 1
  const cx = crop?.x ?? 0.5
  const cy = crop?.y ?? 0.5
  // metadata() 读的是输入文件原始头，不会反映 .rotate() 的 EXIF 转正；
  // orientation 5~8 表示需要 90° 旋转，宽高须交换，否则短边缩放比例会算错。
  const meta = await sharp(imageBuffer).metadata()
  const rotated = (meta.orientation ?? 1) >= 5
  const w = rotated ? (meta.height ?? inputSize) : (meta.width ?? inputSize)
  const h = rotated ? (meta.width ?? inputSize) : (meta.height ?? inputSize)
  const shortSide = Math.max(1, Math.min(w, h))
  const targetCrop = Math.max(1, Math.round(shortSide * size))
  const scale = inputSize / targetCrop
  const resizedW = Math.max(inputSize, Math.round(w * scale))
  const resizedH = Math.max(inputSize, Math.round(h * scale))
  const left = clamp(Math.round(resizedW * cx - inputSize / 2), 0, resizedW - inputSize)
  const top = clamp(Math.round(resizedH * cy - inputSize / 2), 0, resizedH - inputSize)

  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .resize(resizedW, resizedH, { fit: 'fill', kernel: 'lanczos3' })
    .extract({ left, top, width: inputSize, height: inputSize })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })

  return normalizePixels(data, inputSize, mode, info.channels)
}

export async function preprocessImage(
  imagePath: string,
  inputSize: number,
  mode: 'clip' | 'imagenet'
): Promise<Float32Array> {
  const imageBuffer = await fs.readFile(imagePath)
  return extractAndNormalize(imageBuffer, inputSize, mode)
}

/** 兼容旧调用名：实现已改为短边缩放 + 中心裁剪，不再产生 letterbox 黑边 */
export const preprocessLetterbox = preprocessImage

/** 多裁剪 TTA：返回各裁剪的 NCHW float32 张量 */
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
    results.push(await extractAndNormalize(imageBuffer, inputSize, mode, spec))
  }
  return results
}
