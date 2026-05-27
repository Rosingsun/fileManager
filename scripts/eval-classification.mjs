/**
 * 轻量检查：ImageNet 标签数量、fixtures 各目录图片数量。
 * 用法：node scripts/eval-classification.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const expectedCats = [
  'person',
  'animal',
  'landscape',
  'urban',
  'indoor',
  'food',
  'vehicle',
  'document',
  'other'
]

const labelPath = join(root, 'models', 'imagenet1000.json')
const labels = JSON.parse(readFileSync(labelPath, 'utf8'))
console.log('[eval] imagenet1000.json length:', Array.isArray(labels) ? labels.length : 'invalid')

const clipPrompts = join(root, 'models', 'clip-prompts.json')
console.log('[eval] clip-prompts.json exists:', existsSync(clipPrompts))

const fixtureRoot = join(root, 'tests', 'fixtures', 'images')
if (!existsSync(fixtureRoot)) {
  console.log('[eval] no fixtures dir:', fixtureRoot)
  process.exit(0)
}

const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])
let total = 0
for (const cat of expectedCats) {
  const dir = join(fixtureRoot, cat)
  if (!existsSync(dir)) continue
  const n = readdirSync(dir).filter((f) => {
    const p = join(dir, f)
    if (!statSync(p).isFile()) return false
    const ext = f.slice(f.lastIndexOf('.')).toLowerCase()
    return exts.has(ext)
  }).length
  total += n
  if (n) console.log(`[eval] fixtures/${cat}: ${n} images`)
}
console.log('[eval] fixtures total images:', total)
console.log('[eval] 完整 Top-1 评估请在应用内对 fixtures 目录执行批量分类后对照子文件夹标签统计。')
