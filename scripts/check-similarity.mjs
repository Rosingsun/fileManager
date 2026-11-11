#!/usr/bin/env node
/**
 * 相似照片检测链路体检（零依赖）。
 * 只校验「会不会悄悄退化」的关键约束，不重复跑模型。
 */
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const warnings = []
const notes = []

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

// 1. 标定文件
const calibPath = join(root, 'models', 'similarity-calibration.json')
if (!existsSync(calibPath)) {
  problems.push('缺少 models/similarity-calibration.json —— 请运行 npm run calib:similarity')
} else {
  const c = JSON.parse(readFileSync(calibPath, 'utf8'))
  if (c.version !== 2) problems.push(`标定文件 version=${c.version}，应为 2`)
  const wSum = ['pHash', 'dHash', 'color', 'aspect'].reduce((s, k) => s + Number(c.weights?.[k] || 0), 0)
  if (!(wSum > 0)) problems.push('标定权重全为 0')
  if (!(c.threshold >= 60 && c.threshold <= 100)) problems.push(`threshold=${c.threshold} 超出 60~100`)
  if (!(c.semanticThreshold > 0.5 && c.semanticThreshold < 0.99)) {
    problems.push(`semanticThreshold=${c.semanticThreshold} 超出合理区间 (0.5, 0.99)`)
  }
  if (!(c.maxPHashDistance > 0 && c.maxPHashDistance <= 32)) {
    problems.push(`maxPHashDistance=${c.maxPHashDistance} 不合理（应 ≤32）`)
  }
  notes.push(
    `标定：阈值 ${c.threshold}，权重 ${JSON.stringify(c.weights)}，pDist≤${c.maxPHashDistance}，cos≥${c.semanticThreshold}`
  )
  if (c.metrics?.nearRecall) {
    notes.push(`基线：near 检出 ${(c.metrics.nearRecall * 100).toFixed(2)}%，误判 ${(c.metrics.falsePositiveRate * 100).toFixed(3)}%`)
  }
}

// 2. 主进程只能有一份实现（旧内联 aHash 不得复活）
const mainSrc = read('electron/main/main.ts')
if (!mainSrc.includes("from './services/similarityService'")) {
  problems.push('main.ts 未引用 services/similarityService（可能被内联实现覆盖）')
}
if (/resize\(\s*8\s*,\s*8\s*,\s*\{\s*fit:\s*'fill'\s*\}/.test(mainSrc)) {
  problems.push('main.ts 中仍存在 8x8 aHash 内联实现')
}
if (mainSrc.includes('currentScanWindow')) {
  problems.push('main.ts 中仍存在 currentScanWindow 伪取消逻辑')
}

// 3. 引擎与分组必须共用同一打分函数
const svc = read('electron/main/services/similarityService.ts')
if (!svc.includes("from '../utils/similarityGrouping'")) problems.push('similarityService 未使用 similarityGrouping')
if (!svc.includes('isCancelled')) problems.push('similarityService 缺少取消标志传递')
const grouping = read('electron/main/utils/similarityGrouping.ts')
if (!grouping.includes('compareFingerprints')) problems.push('similarityGrouping 未复用 compareFingerprints')
if (!/safeToDelete:\s*tier\s*!==\s*'scene'/.test(grouping)) {
  problems.push("similarityGrouping 的 safeToDelete 规则被改动（scene 必须不可删除）")
}
if (!grouping.includes('groupedPaths.has(r.filePath)')) {
  problems.push('scene 候选未排除已进入安全组的图片（存在交叉风险）')
}

// 4. 评估集
const simManifest = join(root, 'tests', 'fixtures', 'similarity', 'manifest.json')
if (!existsSync(simManifest)) {
  warnings.push('缺少相似检测评估集，可运行 npm run sim:fixtures 生成')
} else {
  const m = JSON.parse(readFileSync(simManifest, 'utf8'))
  notes.push(`评估集：原图 ${m.baseCount}，变换 ${m.variantCount}（失败 ${m.failed}）`)
  if (!m.variantCount) problems.push('评估集变换样本为 0')
}

// 5. scene 档所需的 CLIP 视觉模型（缺失只降级，不阻断）
const clipB32 = join(root, 'models', 'clip-vit-b32-vision-quant.onnx')
if (!existsSync(clipB32)) {
  warnings.push('未找到 models/clip-vit-b32-vision-quant.onnx —— scene 档会降级为不产出语义组')
}

// 6. 前端删除隔离
const resultsView = read('src/components/SimilarityDetection/SimilarityResultsView.tsx')
if (!resultsView.includes('safeToDelete')) {
  problems.push('结果页未按 safeToDelete 做删除隔离')
}
if (!resultsView.includes('g.safeToDelete && selectedGroups.has(g.id)')) {
  problems.push('批量删除/移动未过滤 scene 组')
}

notes.forEach(n => console.log(`  · ${n}`))
warnings.forEach(w => console.warn(`  ! ${w}`))

if (problems.length) {
  console.error('\n相似检测链路体检未通过：')
  problems.forEach(p => console.error(`  ✗ ${p}`))
  process.exit(1)
}
console.log('\n相似检测链路体检通过：三档隔离、单实现与标定参数均符合预期。')
