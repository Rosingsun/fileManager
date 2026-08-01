/**
 * 生成 models/clip-prompts.json / clip-prompts-l14.json
 * 用法: node generate-prompts.mjs [--model b32|l14|all]
 */
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { CLIPTextModelWithProjection, AutoTokenizer } from '@xenova/transformers'
import {
  PROMPTS_BY_CATEGORY,
  DISAMBIGUATION_PROMPTS,
  MODEL_CONFIGS
} from './prompts-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')

function l2Normalize(vec) {
  let s = 0
  for (let i = 0; i < vec.length; i++) s += vec[i] * vec[i]
  const inv = 1 / Math.sqrt(s + 1e-12)
  return Float32Array.from(vec, v => v * inv)
}

async function embedPrompts(textModel, tokenizer, texts) {
  const embeddings = []
  for (const text of texts) {
    const feeds = tokenizer([text], { padding: true, truncation: true })
    const { text_embeds } = await textModel(feeds)
    const data = text_embeds.data
    const arr = new Float32Array(data.length)
    for (let i = 0; i < data.length; i++) arr[i] = data[i]
    embeddings.push(Array.from(l2Normalize(arr)))
  }
  return embeddings
}

async function generateForModel(modelKey) {
  const cfg = MODEL_CONFIGS[modelKey]
  console.log(`Loading CLIP text model: ${cfg.hfId}...`)
  const tokenizer = await AutoTokenizer.from_pretrained(cfg.hfId)
  const textModel = await CLIPTextModelWithProjection.from_pretrained(cfg.hfId)

  const out = {
    modelId: cfg.hfId,
    dim: cfg.dim,
    categories: [],
    disambiguation: []
  }

  for (const category of Object.keys(PROMPTS_BY_CATEGORY)) {
    const prompts = PROMPTS_BY_CATEGORY[category]
    const embeddings = await embedPrompts(textModel, tokenizer, prompts)
    out.categories.push({ category, prompts, embeddings })
  }

  for (const [pairKey, pair] of Object.entries(DISAMBIGUATION_PROMPTS)) {
    const embeddingsA = await embedPrompts(textModel, tokenizer, pair.promptsA)
    const embeddingsB = await embedPrompts(textModel, tokenizer, pair.promptsB)
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
  writeFileSync(dest, JSON.stringify(out), 'utf8')
  console.log('Wrote', dest)
}

async function main() {
  const arg = process.argv.find(a => a.startsWith('--model='))?.split('=')[1]
    ?? process.argv[process.argv.indexOf('--model') + 1]
    ?? 'all'

  const keys = arg === 'all' ? ['b32', 'l14'] : [arg]
  for (const key of keys) {
    if (!MODEL_CONFIGS[key]) {
      console.error(`Unknown model key: ${key}. Use b32, l14, or all.`)
      process.exit(1)
    }
    await generateForModel(key)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
