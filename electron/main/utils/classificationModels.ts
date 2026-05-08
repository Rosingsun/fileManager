import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export const CLASSIFICATION_MODELS = [
  {
    id: 'clip_vit_b32_quant',
    name: 'CLIP ViT-B/32（推荐）',
    description: '零样本场景分类 + MobileNet 辅助，需 clip-prompts.json 与同目录视觉 ONNX',
    sizeMB: 90,
    inputSize: 224,
    downloadUrls: [
      'https://huggingface.co/Xenova/clip-vit-base-patch32-onnx/resolve/main/onnx/vision_model_quantized.onnx',
      'https://huggingface.co/onnx-model-zoo/clip-vit-b32/resolve/main/model.onnx'
    ]
  },
  {
    id: 'mobilenetv2',
    name: 'MobileNetV2',
    description: '轻量级 ImageNet，聚合为 9 大类',
    sizeMB: 14,
    inputSize: 224,
    downloadUrls: [
      'https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/mobilenetv2-7.onnx',
      'https://github.com/onnx/models/raw/master/validated/vision/classification/mobilenet/mobilenetv2-7.onnx',
      'https://huggingface.co/onnxmodelzoo/resolve/main/mobilenet_v2/mobilenetv2-7.onnx'
    ]
  },
  {
    id: 'efficientnet_b0',
    name: 'EfficientNet-B0',
    description: 'ImageNet 聚合为 9 大类',
    sizeMB: 20,
    inputSize: 224,
    downloadUrls: [
      'https://github.com/onnx/models/raw/main/validated/vision/classification/efficientnet/efficientnet-b0.onnx',
      'https://huggingface.co/onnxmodelzoo/resolve/main/efficientnet_b0/efficientnet-b0.onnx'
    ]
  },
  {
    id: 'efficientnet_b4',
    name: 'EfficientNet-B4',
    description: '高精度 ImageNet，聚合为 9 大类',
    sizeMB: 75,
    inputSize: 380,
    downloadUrls: [
      'https://github.com/onnx/models/raw/main/validated/vision/classification/efficientnet-b4/efficientnet-b4.onnx',
      'https://huggingface.co/onnxmodelzoo/resolve/main/efficientnet-b4/efficientnet-b4.onnx'
    ]
  }
] as const

export type ClassificationModelId = (typeof CLASSIFICATION_MODELS)[number]['id']

export const MODEL_FILE_NAMES: Record<ClassificationModelId, string> = {
  clip_vit_b32_quant: 'clip-vit-b32-vision-quant.onnx',
  mobilenetv2: 'mobilenetv2-7.onnx',
  efficientnet_b0: 'efficientnet-b0.onnx',
  efficientnet_b4: 'efficientnet-b4.onnx'
}

export function getModelsDir(cwd: string): string {
  return join(cwd, 'models')
}

export function getClassificationModelPath(cwd: string, modelId: ClassificationModelId): string {
  const name = MODEL_FILE_NAMES[modelId] || `${modelId}.onnx`
  return join(getModelsDir(cwd), name)
}

export function ensureModelsDir(cwd: string): void {
  const d = getModelsDir(cwd)
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
}

/** 根据 models 目录下的标准 ONNX 文件名反查模型 ID（用于手动拷贝 onnx） */
export function modelIdFromOnnxBasename(filename: string): ClassificationModelId | null {
  const base = filename.trim().toLowerCase()
  for (const [id, onnxName] of Object.entries(MODEL_FILE_NAMES) as [ClassificationModelId, string][]) {
    if (onnxName.toLowerCase() === base) return id
  }
  return null
}
