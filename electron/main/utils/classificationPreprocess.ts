import fs from 'fs-extra'
import sharp from 'sharp'

const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073]
const CLIP_STD = [0.26862954, 0.26130258, 0.27577711]
const IMAGENET_MEAN = [0.485, 0.456, 0.406]
const IMAGENET_STD = [0.229, 0.224, 0.225]

/**
 * EXIF 转正 + letterbox 到正方形 + NCHW float32（CLIP 或 ImageNet 归一化）
 */
export async function preprocessLetterbox(
  imagePath: string,
  inputSize: number,
  mode: 'clip' | 'imagenet'
): Promise<Float32Array> {
  const imageBuffer = await fs.readFile(imagePath)
  const mean = mode === 'clip' ? CLIP_MEAN : IMAGENET_MEAN
  const std = mode === 'clip' ? CLIP_STD : IMAGENET_STD

  const resized = await sharp(imageBuffer)
    .rotate()
    .resize(inputSize, inputSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    })
    .ensureAlpha()
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .raw()
    .toBuffer()

  const expectedLength = inputSize * inputSize * 3
  if (resized.length !== expectedLength) {
    console.warn(`[预处理] 像素长度异常 ${resized.length} 期望 ${expectedLength}`)
  }

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
