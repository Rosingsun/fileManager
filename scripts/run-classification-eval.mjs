/**
 * 对 fixtures 目录执行 Top-1 分类评估（需 Node + onnxruntime-node + 模型文件）
 * 用法:
 *   node scripts/run-classification-eval.mjs
 *   node scripts/run-classification-eval.mjs --preset accuracy_max
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const PRESETS = ['accuracy_light', 'accuracy_balanced', 'accuracy_max']
const expectedCats = [
  'person', 'animal', 'landscape', 'urban', 'indoor', 'food', 'vehicle', 'document', 'other'
]
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])

function parseArgs() {
  const presetArg = process.argv.find(a => a.startsWith('--preset='))?.split('=')[1]
    ?? process.argv[process.argv.indexOf('--preset') + 1]
  const presets = presetArg ? [presetArg] : PRESETS
  return { presets }
}

function collectFixtures(fixtureRoot) {
  const items = []
  for (const cat of expectedCats) {
    const dir = join(fixtureRoot, cat)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (!statSync(p).isFile()) continue
      if (!exts.has(extname(f).toLowerCase())) continue
      items.push({ path: p, expected: cat })
    }
  }
  return items
}

function confusionMatrix(results) {
  const matrix = {}
  for (const e of expectedCats) {
    matrix[e] = {}
    for (const a of expectedCats) matrix[e][a] = 0
  }
  for (const r of results) {
    matrix[r.expected][r.predicted] = (matrix[r.expected][r.predicted] ?? 0) + 1
  }
  return matrix
}

async function main() {
  const { presets } = parseArgs()
  const fixtureRoot = join(root, 'tests', 'fixtures', 'images')
  const fixtures = collectFixtures(fixtureRoot)

  console.log('[eval] fixtures:', fixtures.length)
  if (fixtures.length === 0) {
    console.log('[eval] 无 fixture 图片，请按 tests/fixtures/images/README.md 添加')
    process.exit(0)
  }

  const servicePath = pathToFileURL(join(root, 'electron', 'main', 'services', 'imageClassificationService.ts'))
  let classifyImage
  try {
    const mod = await import(servicePath.href)
    classifyImage = mod.classifyImage
  } catch (e) {
    console.warn('[eval] 无法直接 import TS 服务，尝试 compiled 路径...')
    console.warn('[eval]', e.message)
    console.log('[eval] 请在应用内对 fixtures 批量分类，或使用 tsx: npx tsx scripts/run-classification-eval.mjs')
    process.exit(0)
  }

  for (const presetId of presets) {
    let correct = 0
    const rows = []
    for (const item of fixtures) {
      const result = await classifyImage(item.path, root, presetId)
      const ok = result.category === item.expected
      if (ok) correct += 1
      rows.push({ expected: item.expected, predicted: result.category, ok, confidence: result.confidence })
    }
    const acc = ((correct / fixtures.length) * 100).toFixed(1)
    console.log(`\n[eval] preset=${presetId} Top-1=${acc}% (${correct}/${fixtures.length})`)
    const matrix = confusionMatrix(rows)
    for (const e of expectedCats) {
      const wrong = expectedCats.filter(a => a !== e && matrix[e][a] > 0)
      if (wrong.length) {
        console.log(`  ${e} 误判:`, wrong.map(a => `${a}=${matrix[e][a]}`).join(', '))
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
