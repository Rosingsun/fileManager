/**
 * 图片分类参数标定：用带标签评估集的缓存特征做 5 折交叉验证，
 * 搜索 CLIP softmax 温度、prompt 聚合方式、类别偏置、ImageNet 融合权重与弃判阈值，
 * 并拟合置信度校准，结果写入 models/classification-calibration.json。
 *
 * 用法：node scripts/calibrate-classification.mjs
 * 前置：node scripts/bootstrap-classification-fixtures.mjs
 *       npx tsx scripts/extract-classification-features.ts
 *
 * 该脚本是纯计算，不加载任何 ONNX 模型，可在秒级内反复运行。
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const featuresPath = join(root, 'tests', 'fixtures', 'features.json')
const calibrationPath = join(root, 'models', 'classification-calibration.json')

const CATS = ['person', 'animal', 'landscape', 'urban', 'indoor', 'food', 'vehicle', 'document', 'other']
const OTHER_IDX = CATS.indexOf('other')

const PRESETS = {
  accuracy_fast: {
    prompts: join(root, 'models', 'clip-prompts.json'),
    placeholder: join(root, 'models', 'clip-prompts.placeholder.json'),
    clipKey: 'accuracy_fast',
    imagenetKey: 'mobilenetv2',
    fusionGrid: [0]
  },
  accuracy_max: {
    prompts: join(root, 'models', 'clip-prompts-l14.json'),
    placeholder: join(root, 'models', 'clip-prompts-l14.placeholder.json'),
    clipKey: 'accuracy_max',
    imagenetKey: 'efficientnet_b4',
    fusionGrid: [0, 0.1, 0.2, 0.3, 0.4, 0.5]
  }
}

const TEMPERATURES = [0.003, 0.004, 0.006, 0.008, 0.01, 0.015, 0.02, 0.03, 0.045, 0.06]
const MAX_BLENDS = [0, 0.2, 0.4, 0.6, 0.8, 1]
const BIAS_MODES = ['none', 'prior', 'logloss']
const FOLDS = 5

function l2(v) {
  let s = 0
  for (const x of v) s += x * x
  const inv = 1 / Math.sqrt(s + 1e-12)
  return v.map(x => x * inv)
}

function dot(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

function softmax(logits, t) {
  let max = -Infinity
  for (const x of logits) if (x > max) max = x
  const exps = logits.map(x => Math.exp((x - max) / t))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / sum)
}

function argmax(p) {
  let best = 0
  for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i
  return best
}

function readJson(p, required = true) {
  if (!existsSync(p)) {
    if (required) throw new Error(`缺少文件: ${p}`)
    return null
  }
  return JSON.parse(readFileSync(p, 'utf8'))
}

function loadPrompts(file) {
  const j = readJson(file)
  const proto = {}
  const all = {}
  for (const block of j.categories) {
    const embs = block.embeddings.map(l2)
    const dim = embs[0]?.length || 0
    const mean = new Array(dim).fill(0)
    for (const e of embs) for (let i = 0; i < dim; i++) mean[i] += e[i] / embs.length
    proto[block.category] = l2(mean)
    all[block.category] = embs
  }
  return { proto, all, dim: j.dim, source: j.embeddingsSource || 'PLACEHOLDER' }
}

/** 把一张图的 CLIP 嵌入转成与超参无关的相似度原始量 */
function cosinesFor(emb, prompts) {
  const protoCos = []
  const maxCos = []
  const meanCos = []
  for (const cat of CATS) {
    let max = -Infinity
    let sum = 0
    for (const e of prompts.all[cat] || []) {
      const d = dot(emb, e)
      sum += d
      if (d > max) max = d
    }
    const n = (prompts.all[cat] || []).length || 1
    protoCos.push(dot(emb, prompts.proto[cat] || new Array(prompts.dim).fill(0)))
    maxCos.push(max === -Infinity ? 0 : max)
    meanCos.push(sum / n)
  }
  return { protoCos, maxCos, meanCos }
}

function buildSamples(features, preset, prompts) {
  const out = []
  for (const item of features.items) {
    const emb = item.clip?.[preset.clipKey]
    if (!emb || emb.length !== prompts.dim) {
      throw new Error(`特征维度不匹配: ${item.file} / ${preset.clipKey} (${emb?.length} vs ${prompts.dim})`)
    }
    const cos = cosinesFor(emb, prompts)
    const inetRaw = item.imagenet?.[preset.imagenetKey]
    const inet = inetRaw ? CATS.map(c => Number(inetRaw[c] || 0)) : null
    out.push({ file: item.file, expected: item.expected, emb, inet, ...cos })
  }
  return out
}

function logitsFor(s, params) {
  if (s.baseLogits) {
    return s.baseLogits.map((v, i) => v + (params.bias?.[i] || 0))
  }
  const logits = new Array(CATS.length)
  for (let i = 0; i < CATS.length; i++) {
    const base = params.legacy
      ? 0.62 * s.maxCos[i] + 0.38 * s.meanCos[i]
      : (1 - params.maxBlend) * s.protoCos[i] + params.maxBlend * s.maxCos[i]
    logits[i] = base + (params.bias?.[i] || 0)
  }
  return logits
}

function probability(s, params) {
  let p = softmax(logitsFor(s, params), params.temperature)
  const w = params.imagenetWeight || 0
  if (w > 0 && s.inet) {
    p = p.map((v, i) => (1 - w) * v + w * s.inet[i])
    const sum = p.reduce((a, b) => a + b, 0) || 1
    p = p.map(v => v / sum)
  }
  return p
}

/** 迭代比例拟合：把预测边际分布拉回真实边际，校正 CLIP 的系统性类别偏置 */
function fitPriorBias(train, params) {
  const bias = new Array(CATS.length).fill(0)
  const total = train.length
  const target = new Array(CATS.length).fill(1 / CATS.length)
  for (let iter = 0; iter < 14; iter++) {
    const meanP = new Array(CATS.length).fill(0)
    for (const s of train) {
      const p = probability(s, { ...params, bias })
      for (let i = 0; i < CATS.length; i++) meanP[i] += p[i] / total
    }
    for (let i = 0; i < CATS.length; i++) {
      if (i === OTHER_IDX) continue // 固定 other 为锚点，softmax 对整体平移不变
      const delta = params.temperature * 0.6 *
        (Math.log(target[i] + 1e-6) - Math.log(meanP[i] + 1e-6))
      // 余弦量级约 0.2，偏置过大会完全盖过图像信号，限制在 ±0.06
      bias[i] = Math.max(-0.06, Math.min(0.06, bias[i] + delta))
    }
    bias[OTHER_IDX] = 0
  }
  return bias
}

/**
 * 直接在训练集上最小化交叉熵来拟合类别偏置（固定 W=I/T）。
 * 相比 prior 模式只校正边际分布，这个能针对具体混淆做调整。
 */
function fitLogLossBias(train, params) {
  const bias = new Array(CATS.length).fill(0)
  const n = train.length || 1
  const lr = params.temperature * 0.5
  const reg = 0.004
  for (let iter = 0; iter < 140; iter++) {
    const grad = new Array(CATS.length).fill(0)
    for (const s of train) {
      const logits = logitsFor(s, { ...params, bias })
      const p = softmax(logits, params.temperature)
      const gold = CATS.indexOf(s.expected)
      for (let c = 0; c < CATS.length; c++) grad[c] += p[c] - (c === gold ? 1 : 0)
    }
    for (let c = 0; c < CATS.length; c++) {
      if (c === OTHER_IDX) continue
      const g = grad[c] / n + reg * bias[c]
      bias[c] = Math.max(-0.06, Math.min(0.06, bias[c] - lr * g))
    }
    bias[OTHER_IDX] = 0
  }
  return bias
}

function fitBias(train, params) {
  if (params.biasMode === 'prior') return fitPriorBias(train, params)
  if (params.biasMode === 'logloss') return fitLogLossBias(train, params)
  return new Array(CATS.length).fill(0)
}

function stratifiedFolds(samples) {
  const byCat = {}
  for (const s of samples) (byCat[s.expected] ||= []).push(s)
  const folds = Array.from({ length: FOLDS }, () => [])
  for (const list of Object.values(byCat)) {
    for (let i = 0; i < list.length; i++) folds[i % FOLDS].push(list[i])
  }
  return folds
}

function accuracy(rows) {
  return rows.length ? rows.filter(r => r.correct).length / rows.length : 0
}

function meanLogLoss(rows) {
  if (!rows.length) return 0
  return rows.reduce((s, r) => s - Math.log(Math.max(1e-9, r.p[CATS.indexOf(r.expected)])), 0) / rows.length
}

function evaluateCombo(samples, params, folds) {
  const rows = []
  const zeroBias = new Array(CATS.length).fill(0)
  // 每个组合只需算一次基础 logit，折叠内反复迭代时直接复用
  const prepared = samples.map(s => ({ ...s, baseLogits: logitsFor(s, { ...params, bias: zeroBias }) }))
  const foldIndices = folds.map(test => test.map(s => samples.indexOf(s)))
  for (let f = 0; f < foldIndices.length; f++) {
    const testIdx = new Set(foldIndices[f])
    const test = foldIndices[f].map(i => prepared[i])
    const train = prepared.filter((_, i) => !testIdx.has(i))
    const bias = fitBias(train, params)
    for (const s of test) {
      const p = probability(s, { ...params, bias })
      const pred = argmax(p)
      rows.push({
        expected: s.expected,
        predicted: CATS[pred],
        p,
        correct: CATS[pred] === s.expected,
        margin: p[pred] - Math.max(...p.filter((_, i) => i !== pred)),
        top: p[pred]
      })
    }
  }
  return { acc: accuracy(rows), logLoss: meanLogLoss(rows), rows }
}

function gridSearch(samples, presetKey, preset) {
  const folds = stratifiedFolds(samples)
  let best = null
  for (const t of TEMPERATURES) {
    for (const maxBlend of MAX_BLENDS) {
      for (const imagenetWeight of preset.fusionGrid) {
        for (const biasMode of BIAS_MODES) {
          const params = { temperature: t, maxBlend, imagenetWeight, biasMode }
          const res = evaluateCombo(samples, params, folds)
          const key = [res.acc, -res.logLoss]
          if (!best || key[0] > best.key[0] + 1e-9 ||
              (Math.abs(key[0] - best.key[0]) < 1e-9 && key[1] > best.key[1])) {
            best = { params, res, key }
          }
        }
      }
    }
  }
  return best
}

/** 在最优超参的 out-of-fold 预测上搜索弃判阈值（转判 other） */
function fitAbstain(rows) {
  const confGrid = [0, 0.12, 0.20, 0.28, 0.36, 0.45, 0.55]
  const marginGrid = [0, 0.015, 0.04, 0.08]
  let best = { acc: -1, confMin: 0, marginMin: 0 }
  for (const confMin of confGrid) {
    for (const marginMin of marginGrid) {
      const finalRows = rows.map(r => {
        const abstain = r.top < confMin || r.margin < marginMin
        const predicted = abstain ? 'other' : r.predicted
        return { ...r, predicted, correct: predicted === r.expected }
      })
      const acc = accuracy(finalRows)
      if (acc > best.acc + 1e-9) best = { acc, confMin, marginMin }
    }
  }
  return best
}

/** 复核阈值：在不打扰过多结果的前提下，尽量把判错的样本圈进「待复核」 */
function fitReviewThreshold(rows, abstain, conf, maxFlagRate = 0.2) {
  const finals = rows.map(r => {
    const z = conf.topCoef * r.top + conf.marginCoef * r.margin + conf.intercept
    const abstained = r.top < abstain.confMin || r.margin < abstain.marginMin
    const predicted = abstained ? 'other' : r.predicted
    return {
      confidence: 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z)))),
      correct: predicted === r.expected
    }
  })
  const errors = finals.filter(r => !r.correct).length
  let best = { threshold: 0, captured: 0, flagged: 0 }
  for (const t of [0, 0.55, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]) {
    const flagged = finals.filter(r => r.confidence < t)
    if (flagged.length / Math.max(1, finals.length) > maxFlagRate) continue
    const captured = flagged.filter(r => !r.correct).length
    if (captured > best.captured || (captured === best.captured && flagged.length > best.flagged)) {
      best = { threshold: t, captured, flagged: flagged.length }
    }
  }
  return { ...best, errors, ...conf }
}

/** 2 特征逻辑回归：把 (top, margin) 映射为"预测正确"的概率，用作可信置信度 */
function fitConfidence(rows, abstain) {
  const pts = rows.map(r => {
    const abstained = r.top < abstain.confMin || r.margin < abstain.marginMin
    const predicted = abstained ? 'other' : r.predicted
    return { x1: r.top, x2: r.margin, y: predicted === r.expected ? 1 : 0 }
  })
  let a = 2, b = 1, c = -1
  const lr = 0.35
  for (let iter = 0; iter < 900; iter++) {
    let ga = 0, gb = 0, gc = 0
    for (const p of pts) {
      const z = a * p.x1 + b * p.x2 + c
      const q = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))))
      const d = q - p.y
      ga += d * p.x1
      gb += d * p.x2
      gc += d
    }
    const n = pts.length || 1
    a -= lr * ga / n
    b -= lr * gb / n
    c -= lr * gc / n
  }
  return {
    topCoef: Number(a.toFixed(4)),
    marginCoef: Number(b.toFixed(4)),
    intercept: Number(c.toFixed(4))
  }
}

function legacyAccuracy(samples, promptsFile) {
  if (!existsSync(promptsFile)) return null
  const prompts = loadPrompts(promptsFile)
  const params = {
    temperature: 0.058,
    legacy: true,
    maxBlend: 0,
    imagenetWeight: 0,
    bias: new Array(CATS.length).fill(0)
  }
  const rows = samples.map(s => {
    // 旧实现：0.62*max + 0.38*mean，温度 0.058，无偏置、无融合
    const p = probability({ ...s, ...cosinesFor(s.emb, prompts) }, params)
    return { correct: CATS[argmax(p)] === s.expected }
  })
  return accuracy(rows)
}

function main() {
  const features = readJson(featuresPath)
  if (!features.items?.length) throw new Error('features.json 为空')
  const counts = {}
  for (const it of features.items) counts[it.expected] = (counts[it.expected] || 0) + 1
  console.log(`[calib] 样本 ${features.items.length}，分布 ${JSON.stringify(counts)}`)

  const result = {
    version: 2,
    generatedAt: new Date().toISOString(),
    method: '5-fold stratified CV on cached model features',
    sampleCount: features.items.length,
    clipScoring: { temperature: 0.02, maxBlend: 0.2, classBias: Object.fromEntries(CATS.map(c => [c, 0])) },
    fusion: { imagenetWeight: 0 },
    abstain: { confMin: 0, marginMin: 0 },
    confidence: { topCoef: 2, marginCoef: 1, intercept: -1, reviewBelow: 0 },
    disambiguation: { shiftStrength: 0 },
    presetOverrides: {},
    metrics: {}
  }

  for (const [presetKey, preset] of Object.entries(PRESETS)) {
    const prompts = loadPrompts(preset.prompts)
    if (prompts.source !== 'clip-text-model') {
      throw new Error(`${preset.prompts} 不是真实 CLIP 文本嵌入（${prompts.source}），请先运行 generate-prompts.mjs`)
    }
    const samples = buildSamples(features, preset, prompts)
    console.log(`\n[calib] === ${presetKey} (dim=${prompts.dim}, ${samples.length} 样本) ===`)

    const baseline = legacyAccuracy(samples, preset.placeholder)
    const realLegacy = legacyAccuracy(samples, preset.prompts)
    if (baseline !== null) console.log(`[calib] 基线（占位伪嵌入 + 旧参数）: ${(baseline * 100).toFixed(1)}%`)
    if (realLegacy !== null) console.log(`[calib] 真实嵌入 + 旧参数        : ${(realLegacy * 100).toFixed(1)}%`)

    const best = gridSearch(samples, presetKey, preset)
    console.log(`[calib] 最优超参: T=${best.params.temperature}, maxBlend=${best.params.maxBlend}, ` +
      `imagenetWeight=${best.params.imagenetWeight}, biasMode=${best.params.biasMode}`)
    console.log(`[calib] 交叉验证 Top-1: ${(best.res.acc * 100).toFixed(1)}%  (logLoss=${best.res.logLoss.toFixed(3)})`)

    const finalBias = fitBias(samples, best.params)
    const abstain = fitAbstain(best.res.rows)
    const fitted = fitConfidence(best.res.rows, abstain)
    const confidence = fitReviewThreshold(best.res.rows, abstain, fitted)
    console.log(`[calib] 弃判阈值: conf<${abstain.confMin} 或 margin<${abstain.marginMin} → other` +
      `  (OOF ${(abstain.acc * 100).toFixed(1)}%)`)
    console.log(`[calib] 置信度校准: ${JSON.stringify(fitted)}`)
    console.log(`[calib] 复核阈值 conf<${confidence.threshold} → 标记 ${confidence.flagged} 张，覆盖 ${confidence.captured}/${confidence.errors} 个判错样本`)

    const classBias = Object.fromEntries(CATS.map((c, i) => [c, Number(finalBias[i].toFixed(6))]))
    result.presetOverrides[presetKey] = {
      clipScoring: {
        temperature: best.params.temperature,
        maxBlend: best.params.maxBlend,
        classBias
      },
      fusion: { imagenetWeight: best.params.imagenetWeight },
      abstain: { confMin: abstain.confMin, marginMin: abstain.marginMin },
      confidence: {
        topCoef: fitted.topCoef,
        marginCoef: fitted.marginCoef,
        intercept: fitted.intercept,
        reviewBelow: confidence.threshold
      },
      disambiguation: { shiftStrength: 0 }
    }
    result.metrics[presetKey] = {
      baselinePlaceholderAccuracy: baseline,
      realEmbeddingLegacyAccuracy: realLegacy,
      crossValidatedAccuracy: Number(best.res.acc.toFixed(4)),
      crossValidatedWithAbstain: Number(abstain.acc.toFixed(4)),
      logLoss: Number(best.res.logLoss.toFixed(4)),
      reviewBelow: confidence.threshold,
      reviewFlagged: confidence.flagged,
      reviewCapturedErrors: confidence.captured,
      totalErrors: confidence.errors,
      parameters: best.params
    }

    const cm = {}
    for (const c of CATS) cm[c] = {}
    for (const r of best.res.rows) {
      const pred = (r.top < abstain.confMin || r.margin < abstain.marginMin) ? 'other' : r.predicted
      cm[r.expected][pred] = (cm[r.expected][pred] || 0) + 1
    }
    console.log('[calib] 混淆（真→被判为其他类）:')
    for (const c of CATS) {
      const wrong = Object.entries(cm[c]).filter(([k, v]) => k !== c && v > 0)
      if (wrong.length) console.log(`    ${c}: ${wrong.map(([k, v]) => `${k}=${v}`).join(', ')}`)
    }
  }

  writeFileSync(calibrationPath, JSON.stringify(result, null, 2), 'utf8')
  console.log(`\n[calib] 已写入 ${calibrationPath}`)
}

main()
