/**
 * 生成 models/clip-prompts.json（CLIP ViT-B/32 文本嵌入，与 Xenova 视觉 ONNX 配套）
 * 在 scripts/_clip_text_gen 下执行: node generate-prompts.mjs
 */
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { CLIPTextModelWithProjection, AutoTokenizer } from '@xenova/transformers'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')

const PROMPTS_BY_CATEGORY = {
  person: [
    'a photo of a person',
    'a portrait of a human',
    'people in the photo',
    '人物照片',
    '人像摄影',
    '面部特写'
  ],
  animal: [
    'a photo of an animal',
    'wildlife or pet',
    'dog cat bird or other animals',
    '动物照片',
    '宠物或野生动物'
  ],
  landscape: [
    'a landscape photo',
    'nature scenery mountains ocean forest',
    'outdoor natural scenery',
    '自然风景',
    '山水海景森林'
  ],
  urban: [
    'a cityscape or urban scene',
    'buildings street skyline at night',
    '城市建筑街景',
    '夜景或地标'
  ],
  indoor: [
    'an indoor scene',
    'inside a room or building interior',
    '室内场景',
    '家居室内环境'
  ],
  food: [
    'a photo of food or drink',
    'meal dish dessert beverage',
    '食物饮品甜点',
    '餐桌上的美食'
  ],
  vehicle: [
    'a vehicle car truck bus motorcycle',
    'airplane ship boat transportation',
    '交通工具汽车飞机船舶',
    '街道上的车辆'
  ],
  document: [
    'a document screenshot text poster',
    'screenshot of text or UI',
    '文档截图文字界面',
    '纸质文件或屏幕截图'
  ],
  other: [
    'something else',
    'unclear category',
    '其他内容',
    '无法归类的图片'
  ]
}

function l2Normalize(vec) {
  let s = 0
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i]
  const inv = 1 / Math.sqrt(s + 1e-12)
  return Float32Array.from(vec, v => v * inv)
}

async function main() {
  console.log('Loading CLIP text model...')
  const tokenizer = await AutoTokenizer.from_pretrained('Xenova/clip-vit-base-patch32')
  const textModel = await CLIPTextModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32')

  const categories = Object.keys(PROMPTS_BY_CATEGORY)
  const out = {
    modelId: 'Xenova/clip-vit-base-patch32',
    dim: 512,
    categories: []
  }

  for (const category of categories) {
    const prompts = PROMPTS_BY_CATEGORY[category]
    const embeddings = []
    for (const text of prompts) {
      const feeds = tokenizer([text], { padding: true, truncation: true })
      const { text_embeds } = await textModel(feeds)
      const data = text_embeds.data
      const arr = new Float32Array(data.length)
      for (let i = 0; i < data.length; i++) arr[i] = data[i]
      embeddings.push(Array.from(l2Normalize(arr)))
    }
    out.categories.push({ category, prompts, embeddings })
  }

  const dest = join(root, 'models', 'clip-prompts.json')
  writeFileSync(dest, JSON.stringify(out), 'utf8')
  console.log('Wrote', dest)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
