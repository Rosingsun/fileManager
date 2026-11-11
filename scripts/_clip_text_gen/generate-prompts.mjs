/**
 * 生成 models/clip-prompts.json / clip-prompts-l14.json 的真实 CLIP 文本嵌入。
 * 用法: node generate-prompts.mjs --model b32|l14|all
 * 需先在本目录执行 npm install；HF 直连不通时自动使用 hf-mirror 镜像。
 * 生成结果为预计算向量，运行时不依赖本脚本与 @xenova/transformers。
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { env, CLIPTextModelWithProjection, AutoTokenizer } from '@xenova/transformers'
import {
  PROMPTS_BY_CATEGORY,
  DISAMBIGUATION_PROMPTS,
  MODEL_CONFIGS,
  PROMPT_VERSION
} from './prompts-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')

const HF_HOST = process.env.CLIP_HF_ENDPOINT || 'https://hf-mirror.com/'
env.remoteHost = HF_HOST
env.remotePathTemplate = '{model}/resolve/{revision}/'
env.allowLocalModels = false
env.useBrowserCache = false
env.cacheDir = join(__dirname, '.cache')

function l2Normalize(vec) {
  let s = 0
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i]
  const inv = 1 / Math.sqrt(s + 1e-12)
  return Float32Array.from(vec, v => v * inv)
}

function cosine(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/** 同一类别内 prompt 向量的平均两两余弦：真实 CLIP 通常 0.6~0.9，伪嵌入约 0.04 */
function intraClassSimilarity(embeddings) {
  if (embeddings.length < 2) return 0
  let sum = 0
  let count = 0
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      sum += cosine(embeddings[i], embeddings[j])
      count++
    }
  }
  return count ? sum / count : 0
}

async function embedPrompts(textModel, tokenizer, texts, expectedDim) {
  const embeddings = []
  for (const text of texts) {
    const feeds = tokenizer([text], { padding: true, truncation: true })
    const { text_embeds } = await textModel(feeds)
    const data = text_embeds.data
    if (data.length !== expectedDim) {
      throw new Error(`文本向量维度 ${data.length} 与配置 ${expectedDim} 不符，模型与预设不匹配`)
    }
    const arr = new Float32Array(data.length)
    for (let i = 0; i < data.length; i++) arr[i] = data[i]
    embeddings.push(Array.from(l2Normalize(arr)))
  }
  return embeddings
}

async function generateForModel(modelKey) {
  const cfg = MODEL_CONFIGS[modelKey]
  console.log(`[prompts] 加载 CLIP 文本模型 ${cfg.hfId}（镜像 ${HF_HOST}）...`)
  const tokenizer = await AutoTokenizer.from_pretrained(cfg.hfId)
  const textModel = await CLIPTextModelWithProjection.from_pretrained(cfg.hfId)

  const out = {
    modelId: cfg.hfId,
    dim: cfg.dim,
    embeddingsSource: 'clip-text-model',
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    categories: [],
    disambiguation: []
  }

  const quality = []
  for (const [category, prompts] of Object.entries(PROMPTS_BY_CATEGORY)) {
    const embeddings = await embedPrompts(textModel, tokenizer, prompts, cfg.dim)
    const sim = intraClassSimilarity(embeddings)
    quality.push(`${category}=${sim.toFixed(3)}`)
    out.categories.push({ category, prompts, embeddings })
  }

  for (const [pairKey, pair] of Object.entries(DISAMBIGUATION_PROMPTS)) {
    const embeddingsA = await embedPrompts(textModel, tokenizer, pair.promptsA, cfg.dim)
    const embeddingsB = await embedPrompts(textModel, tokenizer, pair.promptsB, cfg.dim)
    out.disambiguation.push({
      pairKey,
      categoryA: pair.a,
      categoryB: pair.b,
      promptsA: pair.promptsA,
      promptsB: pair.promptsB,
      embeddingsA,
      embeddingsB
    })
  }

  const dest = join(root, 'models', cfg.outputFile)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, JSON.stringify(out), 'utf8')
  console.log(`[prompts] 已写入 ${dest}`)
  console.log(`[prompts] 类内余弦: ${quality.join(', ')}`)
}

async function main() {
  const arg = process.argv.find(a => a.startsWith('--model='))?.split('=')[1]
    ?? (process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : null)
    ?? 'all'

  const keys = arg === 'all' ? ['b32', 'l14'] : [arg]
  for (const key of keys) {
    if (!MODEL_CONFIGS[key]) {
      console.error(`未知模型标识: ${key}，可用 b32 / l14 / all`)
      process.exit(1)
    }
    await generateForModel(key)
  }
}

main().catch((e) => {
  console.error('[prompts] 生成失败：', e)
  process.exit(1)
})
