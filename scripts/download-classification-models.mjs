/**
 * 命令行下载分类 ONNX（镜像策略与 Electron 主进程一致）
 * 用法: node scripts/download-classification-models.mjs accuracy_balanced
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const modelsDir = join(root, 'models')
const mirror = (process.env.FILEDEAL_HF_ENDPOINT || 'https://hf-mirror.com').replace(/\/$/, '')

const MODELS = {
  clip_vit_b32_quant: {
    file: 'clip-vit-b32-vision-quant.onnx',
    urls: [
      'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/vision_model_quantized.onnx'
    ]
  },
  clip_vit_l14_quant: {
    file: 'clip-vit-l14-vision-quant.onnx',
    urls: [
      'https://huggingface.co/Xenova/clip-vit-large-patch14/resolve/main/onnx/vision_model_uint8.onnx'
    ]
  },
  mobilenetv2: {
    file: 'mobilenetv2-7.onnx',
    urls: [
      'https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv2-7.onnx'
    ]
  },
  efficientnet_b4: {
    file: 'efficientnet-b4.onnx',
    urls: [
      'https://huggingface.co/Kalray/efficientnet-b4/resolve/main/efficientNet-b4-q.onnx',
      'https://huggingface.co/Kalray/efficientnet-b4/resolve/main/efficientNet-b4.onnx'
    ]
  }
}

const PRESETS = {
  accuracy_light: ['mobilenetv2', 'clip_vit_b32_quant'],
  accuracy_balanced: ['efficientnet_b4', 'clip_vit_b32_quant'],
  accuracy_max: ['efficientnet_b4', 'clip_vit_l14_quant']
}

function expandUrls(urls) {
  const out = []
  const seen = new Set()
  for (const url of urls) {
    for (const u of [url, url.replace('https://huggingface.co/', `${mirror}/`), `https://ghproxy.net/${url}`]) {
      if (!seen.has(u)) {
        seen.add(u)
        out.push(u)
      }
    }
  }
  return out
}

const preset = process.argv[2] || 'accuracy_balanced'
const ids = PRESETS[preset]
if (!ids) {
  console.error('未知预设:', preset)
  process.exit(1)
}

mkdirSync(modelsDir, { recursive: true })

for (const id of ids) {
  const spec = MODELS[id]
  const dest = join(modelsDir, spec.file)
  if (existsSync(dest)) {
    console.log('已存在:', dest)
    continue
  }
  let saved = false
  for (const url of expandUrls(spec.urls)) {
    try {
      console.log('下载', id, '←', url)
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'fileDeal-cli' } })
      if (!res.ok) {
        console.warn('HTTP', res.status)
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 1024) continue
      writeFileSync(dest, buf)
      console.log('完成', dest, `(${(buf.length / 1024 / 1024).toFixed(2)} MB)`)
      saved = true
      break
    } catch (e) {
      console.warn(e.message)
    }
  }
  if (!saved) {
    console.error('失败:', id)
    process.exit(1)
  }
}

console.log('预设', preset, '模型已就绪')
