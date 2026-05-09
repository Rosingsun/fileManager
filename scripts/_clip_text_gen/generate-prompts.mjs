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
    'a portrait of a human face or body',
    'people standing walking sitting in the scene',
    'human subject main focus not an animal',
    'adult or child human figure',
    '人物照片人像',
    '真人特写或全身',
    '自拍或合影',
    '以人为主体不是动物'
  ],
  animal: [
    'a photo of an animal or bird or insect or fish',
    'wildlife creature pet dog cat bird not a human',
    'zoo or nature animal as main subject',
    'no human face or body as the main focus',
    '动物野生或宠物',
    '鸟类昆虫水产四足动物',
    '主体是动物不是人物'
  ],
  landscape: [
    'natural outdoor scenery without city buildings',
    'mountains ocean lake forest field sunset sky',
    'national park hiking trail countryside',
    '自然风景山水海天',
    '原野森林湖泊海滩',
    '无建筑的户外自然风光'
  ],
  urban: [
    'city buildings downtown skyline skyscrapers',
    'busy street traffic urban architecture',
    'bridge plaza landmark exterior urban night lights',
    '城市街景建筑外景',
    '马路车流立交桥商圈',
    '室外人造城市环境'
  ],
  indoor: [
    'inside a room home office classroom ceiling walls furniture',
    'interior of building living room kitchen bedroom',
    'indoor lighting wallpaper floor indoor plants',
    '室内房间家居办公',
    '天花板墙壁门窗室内陈设',
    '建筑物内部不是室外街景'
  ],
  food: [
    'cooked meal dish plate bowl on table',
    'restaurant cafe bakery food close-up',
    'fruits vegetables dessert snack beverage drink',
    '食物菜肴饮品特写',
    '餐桌上的饭菜甜点',
    '美食料理点心水果'
  ],
  vehicle: [
    'car truck bus motorcycle bicycle train airplane boat ship',
    'transportation vehicle wheels engine vehicle exterior',
    'parking lot highway vehicle driving',
    '汽车火车飞机船舶交通工具',
    '机动车非机动车外景',
    '驶中的交通工具'
  ],
  document: [
    'screenshot of computer phone UI text interface',
    'printed paper poster book page handwriting chart',
    'slide presentation spreadsheet dense text',
    '屏幕截图文字密集界面',
    '纸质海报书本图表',
    '办公文档表格幻灯片'
  ],
  other: [
    'abstract pattern texture wallpaper macro object unclear',
    'toys tools sports equipment close-up without clear scene',
    'miscellaneous object not fitting other categories',
    '难以归类的小物件特写',
    '抽象纹理图案',
    '无法判断场景的杂物'
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
