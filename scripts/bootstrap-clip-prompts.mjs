/**
 * 离线生成 clip-prompts.json / clip-prompts-l14.json 结构（确定性伪嵌入）
 * 联网后请运行 scripts/_clip_text_gen/generate-prompts.mjs 替换为真实 CLIP 文本嵌入
 */
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  PROMPTS_BY_CATEGORY,
  DISAMBIGUATION_PROMPTS,
  MODEL_CONFIGS
} from './_clip_text_gen/prompts-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function l2Normalize(arr) {
  let s = 0
  for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i]
  const inv = 1 / Math.sqrt(s + 1e-12)
  return Array.from(arr, v => v * inv)
}

function pseudoEmbed(text, dim) {
  const arr = new Float32Array(dim)
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  for (let i = 0; i < dim; i++) {
    const t = hash + i * 2654435761
    arr[i] = Math.sin(t * 0.0001) * 0.6 + Math.cos(t * 0.00007) * 0.4
  }
  return l2Normalize(arr)
}

function buildPromptsFile(modelKey) {
  const cfg = MODEL_CONFIGS[modelKey]
  const out = {
    modelId: cfg.hfId,
    dim: cfg.dim,
    _note: 'PLACEHOLDER embeddings — run scripts/_clip_text_gen/generate-prompts.mjs when online',
    categories: [],
    disambiguation: []
  }

  for (const [category, prompts] of Object.entries(PROMPTS_BY_CATEGORY)) {
    out.categories.push({
      category,
      prompts,
      embeddings: prompts.map(p => pseudoEmbed(`${cfg.hfId}:${category}:${p}`, cfg.dim))
    })
  }

  for (const [pairKey, pair] of Object.entries(DISAMBIGUATION_PROMPTS)) {
    out.disambiguation.push({
      pairKey,
      categoryA: pair.a,
      categoryB: pair.b,
      promptsA: pair.promptsA,
      promptsB: pair.promptsB,
      embeddingsA: pair.promptsA.map(p => pseudoEmbed(`${cfg.hfId}:${pairKey}:A:${p}`, cfg.dim)),
      embeddingsB: pair.promptsB.map(p => pseudoEmbed(`${cfg.hfId}:${pairKey}:B:${p}`, cfg.dim))
    })
  }

  return { dest: join(root, 'models', cfg.outputFile), data: out }
}

const arg = process.argv[2] ?? 'all'
const keys = arg === 'all' ? ['b32', 'l14'] : [arg]
for (const key of keys) {
  const { dest, data } = buildPromptsFile(key)
  writeFileSync(dest, JSON.stringify(data), 'utf8')
  console.log('Wrote placeholder', dest)
}
