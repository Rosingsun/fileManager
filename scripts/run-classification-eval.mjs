/**
 * 端到端 Top-1 评估：直接调用真实的分类服务（含预处理、ONNX 推理、融合、弃判、置信度校准）。
 *
 * 用法：
 *   npm run eval:classify-run                       # 两个预设都跑
 *   npm run eval:classify-run -- --preset accuracy_max
 *   npm run eval:classify-run -- --limit 20 --json
 *
 * 前置：先构建 fixtures（npm run fixtures:classify），并生成真实 CLIP 文本嵌入。
 */
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = join(root, 'tests', 'fixtures', 'manifest.json')

const CATEGORIES = ['person', 'animal', 'landscape', 'urban', 'indoor', 'food', 'vehicle', 'document', 'other']
const PRESET_ALIASES = { accuracy_light: 'accuracy_fast', accuracy_balanced: 'accuracy_max' }

function arg(name, fallback = null) {
  const eq = process.argv.find(a => a.startsWith(`--${name}=`))
  if (eq) return eq.split('=').slice(1).join('=')
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

const asPercent = v => `${(v * 100).toFixed(1)}%`

function report(presetId, rows) {
  const valid = rows.filter(r => r.status !== 'failed')
  const correct = valid.filter(r => r.correct).length
  const acc = valid.length ? correct / valid.length : 0
  console.log(`\n[eval] ========== ${presetId} ==========`)
  console.log(`[eval] 样本 ${rows.length}，失败 ${rows.length - valid.length}，Top-1 准确率 ${asPercent(acc)} (${correct}/${valid.length})`)

  if (rows.length > valid.length) {
    const reasons = {}
    for (const r of rows.filter(x => x.status === 'failed')) reasons[r.reason] = (reasons[r.reason] || 0) + 1
    console.log('[eval] 失败原因:', JSON.stringify(reasons))
  }

  console.log('[eval] 各类召回:')
  for (const c of CATEGORIES) {
    const subset = valid.filter(r => r.expected === c)
    if (!subset.length) continue
    const hit = subset.filter(r => r.correct).length
    const wrong = {}
    for (const r of subset.filter(x => !x.correct)) wrong[r.predicted] = (wrong[r.predicted] || 0) + 1
    const suffix = Object.keys(wrong).length ? `  误判: ${Object.entries(wrong).map(([k, v]) => `${k}=${v}`).join(', ')}` : ''
    console.log(`   ${c.padEnd(10)} ${asPercent(hit / subset.length).padStart(7)}  (${hit}/${subset.length})${suffix}`)
  }

  const uncertain = valid.filter(r => r.status === 'uncertain')
  if (uncertain.length) {
    const hit = uncertain.filter(r => r.correct).length
    console.log(`[eval] 不确定样本 ${uncertain.length}，其中判对 ${hit} (${asPercent(hit / uncertain.length)})`)
  }

  // 置信度可靠性：按 0.1 分桶比较平均置信度与实际正确率
  const buckets = Array.from({ length: 10 }, () => ({ n: 0, conf: 0, hit: 0 }))
  for (const r of valid) {
    const i = Math.min(9, Math.max(0, Math.floor(r.confidence * 10)))
    buckets[i].n++
    buckets[i].conf += r.confidence
    buckets[i].hit += r.correct ? 1 : 0
  }
  let ece = 0
  for (const b of buckets) {
    if (!b.n) continue
    ece += (b.n / valid.length) * Math.abs(b.conf / b.n - b.hit / b.n)
  }
  console.log(`[eval] 置信度校准误差 ECE = ${ece.toFixed(4)}（越低越可信）`)
  const shown = buckets.map((b, i) => b.n ? `${(i / 10).toFixed(1)}~${((i + 1) / 10).toFixed(1)}:n=${b.n},acc=${asPercent(b.hit / b.n)}` : null).filter(Boolean)
  console.log(`[eval] 分桶 ${shown.join('  ')}`)

  return { presetId, accuracy: acc, correct, total: valid.length, failed: rows.length - valid.length, ece }
}

async function main() {
  if (!existsSync(manifestPath)) {
    throw new Error(`缺少 ${manifestPath}，请先运行 npm run fixtures:classify`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  let items = (manifest.items || [])
    .map(it => ({ ...it, resolved: join(root, it.file) }))
    .filter(it => existsSync(it.resolved))
  const limit = Number(arg('limit', 0)) || 0
  if (limit > 0) items = items.slice(0, limit)
  if (!items.length) throw new Error('评估集为空')
  // 小样本试跑不得覆盖全量评估明细
  const resultsPath = limit > 0
    ? join(root, 'tests', 'fixtures', 'eval-results-limited.json')
    : join(root, 'tests', 'fixtures', 'eval-results.json')
  console.log(`[eval] 图片数 ${items.length}`)

  const presetArg = arg('preset')
  const presets = presetArg ? [PRESET_ALIASES[presetArg] || presetArg] : ['accuracy_fast', 'accuracy_max']

  const servicePath = pathToFileURL(join(root, 'electron', 'main', 'services', 'imageClassificationService.ts'))
  const { classifyImage } = await import(servicePath.href)
  if (typeof classifyImage !== 'function') throw new Error('无法加载 classifyImage（请用 npx tsx 运行本脚本）')

  const summary = []
  const allRows = {}
  for (const presetId of presets) {
    const rows = []
    const started = Date.now()
    for (const [i, item] of items.entries()) {
      const r = await classifyImage(item.resolved, root, presetId)
      rows.push({
        file: item.file,
        expected: item.category,
        predicted: r.category,
        correct: r.category === item.category,
        confidence: r.confidence ?? 0,
        status: r.classificationStatus || 'ok',
        reason: r.failureReason || '',
        topPredictions: r.topPredictions || []
      })
      if ((i + 1) % 25 === 0) console.log(`[eval] ${presetId} ${i + 1}/${items.length}`)
    }
    console.log(`[eval] ${presetId} 用时 ${((Date.now() - started) / 1000).toFixed(0)}s`)
    allRows[presetId] = rows
    summary.push(report(presetId, rows))
  }

  if (process.argv.includes('--json')) {
    writeFileSync(resultsPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      summary,
      rows: allRows
    }, null, 2), 'utf8')
    console.log(`\n[eval] 明细已写入 ${resultsPath}`)
  }
}

main().catch(e => {
  console.error('[eval] 失败:', e)
  process.exit(1)
})
