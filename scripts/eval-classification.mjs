/**
 * 分类链路体检（快速、零模型开销）：
 *   1. 校验 CLIP 文本嵌入文件是否为真实编码器产物（伪嵌入会让分类退回随机猜）
 *   2. 校验向量维度与声明一致、9 大类齐全
 *   3. 校验标定配置版本与评估集 manifest
 * 用法：npm run eval:classify
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CATEGORIES = ['person', 'animal', 'landscape', 'urban', 'indoor', 'food', 'vehicle', 'document', 'other']
let failed = 0

function check(ok, label, detail = '') {
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

const promptFiles = ['clip-prompts.json', 'clip-prompts-l14.json']
for (const name of promptFiles) {
  const p = join(root, 'models', name)
  if (!existsSync(p)) {
    check(false, `${name} 存在`, '请运行 npm run gen:clip-prompts')
    continue
  }
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'))
    check(j.embeddingsSource === 'clip-text-model', `${name} 为真实 CLIP 文本嵌入`,
      `embeddingsSource=${j.embeddingsSource ?? '缺失'}`)
    const cats = (j.categories || []).map(c => c.category)
    check(CATEGORIES.every(c => cats.includes(c)), `${name} 覆盖 9 大类`, `${cats.length} 类`)
    const dims = (j.categories || []).map(c => c.embeddings?.[0]?.length)
    check(dims.every(d => d === j.dim), `${name} 向量维度一致`, `dim=${j.dim}`)
    check((j.promptVersion ?? 0) >= 2, `${name} prompt 版本`, `v${j.promptVersion ?? 0}`)
  } catch (e) {
    check(false, `${name} 可解析`, e.message)
  }
}

const calPath = join(root, 'models', 'classification-calibration.json')
if (existsSync(calPath)) {
  const cal = JSON.parse(readFileSync(calPath, 'utf8'))
  check(cal.version >= 2, '标定配置版本 >= 2', `v${cal.version}`)
  for (const preset of ['accuracy_fast', 'accuracy_max']) {
    const o = cal.presetOverrides?.[preset]
    check(!!o?.clipScoring?.temperature && !!o?.confidence, `${preset} 标定参数齐全`,
      o ? `T=${o.clipScoring.temperature}, ImageNet 权重=${o.fusion?.imagenetWeight}` : '缺失')
  }
} else {
  check(false, '标定配置存在', '请运行 npm run calib:classify')
}

const labels = JSON.parse(readFileSync(join(root, 'models', 'imagenet1000.json'), 'utf8'))
check(Array.isArray(labels) && labels.length === 1000, 'imagenet1000.json 标签数', String(labels?.length))

const manifestPath = join(root, 'tests', 'fixtures', 'manifest.json')
if (!existsSync(manifestPath)) {
  console.log('[INFO] 无评估 manifest，跳过样本统计。构建评估集：npm run fixtures:classify')
} else {
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const counts = {}
  for (const it of m.items || []) counts[it.category] = (counts[it.category] || 0) + 1
  const missing = (m.items || []).filter(it => !existsSync(join(root, it.file))).length
  check(missing === 0, '评估图片文件齐全', `${m.items?.length ?? 0} 张，缺失 ${missing}`)
  console.log(`[INFO] 评估集分布 ${JSON.stringify(counts)}`)
}

const fixtureRoot = join(root, 'tests', 'fixtures', 'images')
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp'])
if (existsSync(fixtureRoot)) {
  let total = 0
  for (const cat of CATEGORIES) {
    const dir = join(fixtureRoot, cat)
    if (!existsSync(dir)) continue
    total += readdirSync(dir).filter(f => {
      const p = join(dir, f)
      return statSync(p).isFile() && exts.has(f.slice(f.lastIndexOf('.')).toLowerCase())
    }).length
  }
  console.log(`[INFO] fixtures 目录实际图片数 ${total}`)
}

console.log('\n完整准确率评估：npm run eval:classify-run')
console.log('参数重新标定：npm run features:classify && npm run calib:classify')
if (failed) {
  console.error(`\n[eval] 体检未通过，共 ${failed} 项异常`)
  process.exit(1)
}
console.log('\n[eval] 体检通过')
