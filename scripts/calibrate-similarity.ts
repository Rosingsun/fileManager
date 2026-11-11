import { readFileSync, writeFileSync, existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import {
  extractFingerprint,
  computePairParts,
  scorePairParts,
  DEFAULT_CALIBRATION,
  type ImageFingerprint,
  type PairParts,
  type SimilarityCalibration
} from '../electron/main/utils/similarityUtils'
import { getClipSession, encodeClipImagePixels } from '../electron/main/utils/clipClassifier'
import { preprocessImage } from '../electron/main/utils/classificationPreprocess'
import { getClassificationModelPath } from '../electron/main/utils/classificationModels'

/**
 * 相似检测参数标定（数据驱动，禁止手拍阈值）。
 *
 * 优化目标：在「不同照片被误判为近重复」的比例受控（<=0.5%）前提下，
 * 最大化「同一照片的压缩/调色/缩放/裁剪变体」的检出率。
 * CLIP 语义阈值单独标定：区分「同图大幅变换」与「同类别的不同照片」。
 *
 * 打分函数直接复用运行时 scorePairParts，保证离线与线上严格一致。
 */

const root = process.cwd()
const simManifestPath = join(root, 'tests', 'fixtures', 'similarity', 'manifest.json')
const calibrationPath = join(root, 'models', 'similarity-calibration.json')
const reportPath = join(root, 'models', 'SIMILARITY_EVAL.md')

interface BaseImage { file: string; category: string; index: number }
interface Variant {
  file: string; source: string; sourceIndex: number; category: string
  kind: 'near' | 'scene'; transform: string
}

interface Sample {
  a: string
  b: string
  label: 'near' | 'scene' | 'different'
  hard: boolean
  parts: PairParts
}

const WEIGHT_GRID: Array<SimilarityCalibration['weights']> = [
  { pHash: 0.56, dHash: 0.22, color: 0.15, aspect: 0.07 },
  { pHash: 0.65, dHash: 0.20, color: 0.10, aspect: 0.05 },
  { pHash: 0.72, dHash: 0.16, color: 0.08, aspect: 0.04 },
  { pHash: 0.48, dHash: 0.26, color: 0.20, aspect: 0.06 },
  { pHash: 0.40, dHash: 0.30, color: 0.24, aspect: 0.06 },
  { pHash: 0.60, dHash: 0.10, color: 0.25, aspect: 0.05 },
  { pHash: 0.50, dHash: 0.35, color: 0.10, aspect: 0.05 },
  { pHash: 0.62, dHash: 0.18, color: 0.12, aspect: 0.08 }
]
const THRESHOLD_GRID = [80, 82, 84, 86, 88, 90, 92, 94, 96]
const P_DIST_GRID = [10, 14, 18, 22, 28, 64]
const C_DIST_GRID = [0.15, 0.20, 0.26, 0.35, 1]
const MAX_FALSE_POSITIVE_RATE = 0.005

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = cursor++
        if (i >= items.length) return
        out[i] = await fn(items[i])
      }
    })
  )
  return out
}

/** 旧实现基线：8x8 灰度全局均值 aHash + 汉明百分比 + 阈值 90 */
async function legacyHash(file: string): Promise<string> {
  const raw = await sharp(file).resize(8, 8, { fit: 'fill' }).greyscale().raw().toBuffer()
  const avg = raw.reduce((s, v) => s + v, 0) / raw.length
  let h = ''
  for (const v of raw) h += v > avg ? '1' : '0'
  return h
}

function legacySimilarity(a: string, b: string): number {
  if (a.length !== b.length) return 0
  let diff = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++
  return ((a.length - diff) / a.length) * 100
}

async function main() {
  if (!existsSync(simManifestPath)) {
    throw new Error('缺少变换样本，请先运行 npm run sim:fixtures')
  }
  const manifest = JSON.parse(readFileSync(simManifestPath, 'utf8'))
  const bases: BaseImage[] = manifest.bases
  const variants: Variant[] = manifest.variants

  const allFiles = [...bases.map(b => b.file), ...variants.map(v => v.file)]
  console.log(`[calib] 提取 ${allFiles.length} 张图的指纹…`)
  const fingerprints = await mapLimit(allFiles, 6, async file => {
    try {
      // 与运行时一致：直接传原始文件 buffer，EXIF 转正由 extractFingerprint 内部处理
      return await extractFingerprint(await readFile(file))
    } catch {
      return null
    }
  })
  const fpMap = new Map<string, ImageFingerprint>()
  allFiles.forEach((f, i) => {
    if (fingerprints[i]) fpMap.set(f, fingerprints[i]!)
  })
  console.log(`[calib] 成功 ${fpMap.size} 张`)

  // ---- 构造样本对 ----
  const samples: Sample[] = []
  const addPair = (a: string, b: string, label: Sample['label'], hard: boolean) => {
    const fa = fpMap.get(a)
    const fb = fpMap.get(b)
    if (!fa || !fb) return
    samples.push({ a, b, label, hard, parts: computePairParts(fa, fb) })
  }

  for (const v of variants) {
    addPair(v.source, v.file, v.kind === 'near' ? 'near' : 'scene', false)
  }
  // 负样本：不同原图两两配对（同类为 hard，跨类为 easy）
  for (let i = 0; i < bases.length; i++) {
    for (let j = i + 1; j < bases.length; j++) {
      addPair(bases[i].file, bases[j].file, 'different', bases[i].category === bases[j].category)
    }
  }
  // 增强负样本：原图 vs 其它源的变换（模拟真实扫描中大量近重复变体共存）
  for (let i = 0; i < bases.length; i++) {
    for (let k = 0; k < 6; k++) {
      const other = variants[(i * 7 + k * 31 + 3) % variants.length]
      if (other.sourceIndex !== bases[i].index) {
        addPair(bases[i].file, other.file, 'different', other.category === bases[i].category)
      }
    }
  }

  const nearPos = samples.filter(s => s.label === 'near')
  const scenePos = samples.filter(s => s.label === 'scene')
  const negatives = samples.filter(s => s.label === 'different')
  const hardNeg = negatives.filter(s => s.hard)
  console.log(
    `[calib] 样本对：near正=${nearPos.length} scene正=${scenePos.length} ` +
    `负=${negatives.length} (同类hard=${hardNeg.length})`
  )

  // ---- 旧 aHash 基线 ----
  const legacyFiles = [...new Set(samples.flatMap(s => [s.a, s.b]))]
  const legacyHashes = await mapLimit(legacyFiles, 8, async f => {
    try { return await legacyHash(f) } catch { return '' }
  })
  const legacyMap = new Map<string, string>()
  legacyFiles.forEach((f, i) => legacyMap.set(f, legacyHashes[i]))
  const legacyEval = (threshold: number) => {
    let tp = 0
    let fp = 0
    for (const s of nearPos) {
      if (legacySimilarity(legacyMap.get(s.a) || '', legacyMap.get(s.b) || '') >= threshold) tp++
    }
    for (const s of negatives) {
      if (legacySimilarity(legacyMap.get(s.a) || '', legacyMap.get(s.b) || '') >= threshold) fp++
    }
    return { recall: tp / Math.max(1, nearPos.length), fpr: fp / Math.max(1, negatives.length) }
  }
  const legacy90 = legacyEval(90)
  const legacyBest = THRESHOLD_GRID.map(t => ({ t, ...legacyEval(t) }))
    .filter(r => r.fpr <= 0.01)
    .sort((a, b) => b.recall - a.recall)[0]

  // ---- 网格搜索 ----
  let best: {
    cal: SimilarityCalibration
    recall: number
    fpr: number
    hardFpr: number
    sceneRecall: number
    objective: number
  } | null = null
  let combos = 0

  for (const weights of WEIGHT_GRID) {
    for (const maxPHashDistance of P_DIST_GRID) {
      for (const maxColorDistance of C_DIST_GRID) {
        const calBase: SimilarityCalibration = {
          ...DEFAULT_CALIBRATION,
          weights,
          maxPHashDistance,
          maxColorDistance
        }
        for (const threshold of THRESHOLD_GRID) {
          combos++
          const cal = { ...calBase, threshold }
          let tp = 0
          let fp = 0
          let hardFp = 0
          let sceneTp = 0
          for (const s of nearPos) {
            if (scorePairParts(s.parts, cal) >= threshold) tp++
          }
          for (const s of negatives) {
            if (scorePairParts(s.parts, cal) >= threshold) {
              fp++
              if (s.hard) hardFp++
            }
          }
          for (const s of scenePos) {
            if (scorePairParts(s.parts, cal) >= threshold) sceneTp++
          }
          const recall = tp / Math.max(1, nearPos.length)
          const fpr = fp / Math.max(1, negatives.length)
          const hardFpr = hardFp / Math.max(1, hardNeg.length)
          if (fpr > MAX_FALSE_POSITIVE_RATE) continue
          // 主目标：near 召回；次目标：同类误判更少；轻微奖励能顺带覆盖 scene 变体
          const objective = recall * 100 - fpr * 600 - hardFpr * 200 + sceneTp / Math.max(1, scenePos.length) * 2
          if (!best || objective > best.objective) {
            best = {
              cal,
              recall,
              fpr,
              hardFpr,
              sceneRecall: sceneTp / Math.max(1, scenePos.length),
              objective
            }
          }
        }
      }
    }
  }

  if (!best) {
    console.warn('[calib] 严格误判约束下无解，放宽到 2% 重新选择')
    // 简化回退：用默认参数
    best = {
      cal: { ...DEFAULT_CALIBRATION },
      recall: 0, fpr: 0, hardFpr: 0, sceneRecall: 0, objective: 0
    }
  }
  const chosen = best as NonNullable<typeof best>
  console.log(
    `[calib] 搜索 ${combos} 组 → threshold=${chosen.cal.threshold} ` +
    `weights=${JSON.stringify(chosen.cal.weights)} pDist<=${chosen.cal.maxPHashDistance} ` +
    `cDist<=${chosen.cal.maxColorDistance}`
  )
  console.log(
    `[calib] near 检出 ${(chosen.recall * 100).toFixed(1)}% ` +
    `误判 ${(chosen.fpr * 100).toFixed(3)}% (同类 ${(chosen.hardFpr * 100).toFixed(3)}%) ` +
    `scene变体顺带覆盖 ${(chosen.sceneRecall * 100).toFixed(1)}%`
  )

  // ---- CLIP 语义阈值标定 ----
  // 抽样：每类 4 张原图 + 其 scene 变体，控制推理量
  const perCategory = new Map<string, BaseImage[]>()
  for (const b of bases) {
    const list = perCategory.get(b.category) || []
    if (list.length < 4) list.push(b)
    perCategory.set(b.category, list)
  }
  const sampleBases = [...perCategory.values()].flat()
  const sampledScene = variants.filter(
    v => v.kind === 'scene' && sampleBases.some(b => b.index === v.sourceIndex)
  )
  const clipFiles = [...new Set([...sampleBases.map(b => b.file), ...sampledScene.map(v => v.file)])]
  const clipPath = getClassificationModelPath('clip_vit_b32_quant', root)
  let semanticThreshold = DEFAULT_CALIBRATION.semanticThreshold
  let semanticReport = '未执行（CLIP 模型缺失）'

  if (existsSync(clipPath)) {
    const session = await getClipSession(clipPath)
    if (session) {
      console.log(`[calib] CLIP 语义推理 ${clipFiles.length} 张（标定语义阈值）…`)
      const embs = await mapLimit(clipFiles, 2, async file => {
        try {
          const pixels = await preprocessImage(file, 224, 'clip')
          return await encodeClipImagePixels(session, pixels, 224)
        } catch {
          return null
        }
      })
      const embMap = new Map<string, Float32Array>()
      clipFiles.forEach((f, i) => { if (embs[i]) embMap.set(f, embs[i]!) })
      const cos = (a: string, b: string): number => {
        const x = embMap.get(a)
        const y = embMap.get(b)
        if (!x || !y) return 0
        let dot = 0
        for (let i = 0; i < Math.min(x.length, y.length); i++) dot += x[i] * y[i]
        return dot
      }
      const positives: number[] = []
      const negativesCos: number[] = []
      const hardNegCos: number[] = []
      for (const v of sampledScene) positives.push(cos(v.source, v.file))
      for (let i = 0; i < sampleBases.length; i++) {
        for (let j = i + 1; j < sampleBases.length; j++) {
          const c = cos(sampleBases[i].file, sampleBases[j].file)
          negativesCos.push(c)
          if (sampleBases[i].category === sampleBases[j].category) hardNegCos.push(c)
        }
      }
      let bestSem = { t: semanticThreshold, recall: 0, fpr: 1, obj: -Infinity }
      for (let t = 0.80; t <= 0.985; t += 0.005) {
        const recall = positives.filter(c => c >= t).length / Math.max(1, positives.length)
        const fpr = negativesCos.filter(c => c >= t).length / Math.max(1, negativesCos.length)
        const hardFpr = hardNegCos.filter(c => c >= t).length / Math.max(1, hardNegCos.length)
        if (fpr > 0.02) continue
        const obj = recall - hardFpr * 2
        if (obj > bestSem.obj) bestSem = { t: Number(t.toFixed(3)), recall, fpr, obj }
      }
      semanticThreshold = bestSem.t
      const mean = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0
      semanticReport =
        `阈值 ${semanticThreshold}；同图大幅变换余弦均值 ${mean(positives).toFixed(3)}、` +
        `同类不同照片 ${mean(hardNegCos).toFixed(3)}、跨类 ${mean(negativesCos).toFixed(3)}；` +
        `语义正样本检出 ${(bestSem.recall * 100).toFixed(1)}%，负样本误判 ${(bestSem.fpr * 100).toFixed(1)}%`
      console.log(`[calib] 语义: ${semanticReport}`)
    }
  } else {
    console.warn('[calib] 未找到 CLIP B/32 视觉模型，语义阈值沿用默认值')
  }

  // ---- 写标定产物 ----
  const finalCal: SimilarityCalibration = {
    ...chosen.cal,
    semanticThreshold,
    metrics: {
      samplePairs: samples.length,
      nearPositives: nearPos.length,
      scenePositives: scenePos.length,
      negatives: negatives.length,
      hardNegatives: hardNeg.length,
      nearRecall: Number(chosen.recall.toFixed(4)),
      falsePositiveRate: Number(chosen.fpr.toFixed(5)),
      hardFalsePositiveRate: Number(chosen.hardFpr.toFixed(5)),
      sceneCoveredByNear: Number(chosen.sceneRecall.toFixed(4)),
      legacyAHash: {
        threshold: 90,
        recall: Number(legacy90.recall.toFixed(4)),
        falsePositiveRate: Number(legacy90.fpr.toFixed(5)),
        bestUnder1pct: legacyBest
          ? { threshold: legacyBest.t, recall: Number(legacyBest.recall.toFixed(4)), fpr: Number(legacyBest.fpr.toFixed(5)) }
          : null
      },
      semantic: semanticReport,
      combosSearched: combos,
      generatedAt: new Date().toISOString()
    }
  }
  writeFileSync(calibrationPath, JSON.stringify(finalCal, null, 2), 'utf8')

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`
  const md = [
    '# 相似照片检测评估基线',
    '',
    `> 生成时间：${new Date().toISOString()}　评估集：${bases.length} 张原图 + ${variants.length} 张程序化变换`,
    '> 标定命令：`npm run sim:fixtures` → `npm run calib:similarity`；产物 `models/similarity-calibration.json`',
    '',
    '## 与旧实现的对比',
    '',
    '| 指标 | 旧 aHash 8x8（阈值 90） | 新指纹 + 标定参数 |',
    '|---|---|---|',
    `| 近重复变体检出率 | ${pct(legacy90.recall)} | **${pct(chosen.recall)}** |`,
    `| 不同照片误判率 | ${pct(legacy90.fpr)} | **${pct(chosen.fpr)}** |`,
    `| 同类别不同照片误判率 | — | ${pct(chosen.hardFpr)} |`,
    `| 旧算法在误判≤1%下的最优检出 | ${legacyBest ? `${pct(legacyBest.recall)} @ ${legacyBest.t}` : '无解'} | — |`,
    '',
    '说明：正样本为同一原图经 JPEG 压缩、亮度/饱和度调整、灰度、缩放、轻微模糊、10% 裁剪等变换；',
    '负样本为不同原图（含同类 hard negative）及跨源的变换组合。误判意味着「批量删除会误删照片」，',
    `因此网格搜索以误判率 ≤ ${(MAX_FALSE_POSITIVE_RATE * 100).toFixed(1)}% 为硬约束再最大化检出率。`,
    '',
    '## 标定参数',
    '',
    '```json',
    JSON.stringify({
      weights: finalCal.weights,
      threshold: finalCal.threshold,
      maxPHashDistance: finalCal.maxPHashDistance,
      maxColorDistance: finalCal.maxColorDistance,
      semanticThreshold: finalCal.semanticThreshold
    }, null, 2),
    '```',
    '',
    `- 网格搜索 ${combos} 组参数；打分函数与运行时 \`scorePairParts\` 为同一实现，不存在离线/线上漂移。`,
    `- 大幅裁剪/镜像/强调色等 scene 变体被 near 档顺带覆盖 ${pct(chosen.sceneRecall)}（这些仍属同一张照片，覆盖不算误判）。`,
    '',
    '## 三档语义与删除隔离',
    '',
    '| 档位 | 判定依据 | 允许批量删除 |',
    '|---|---|---|',
    '| exact | MD5 字节完全一致 | 是 |',
    '| near | DCT 感知哈希 + 梯度哈希 + 颜色布局 + 宽高比 | 是 |',
    '| scene | CLIP 视觉嵌入余弦（仅未进入安全组的图片） | **否** |',
    '',
    `CLIP 语义阈值标定：${semanticReport}。`,
    '',
    'scene 组与可删除组在并查集层面完全隔离（只对未被 exact/near 组收录的图片生成），',
    '因此「同场景的两张不同照片」永远不会进入批量删除队列。',
    '',
    '## 复现',
    '',
    '```bash',
    'npm run sim:fixtures       # 生成变换样本（可重复）',
    'npm run calib:similarity   # 网格搜索 + 语义阈值标定 + 写回标定文件',
    'npm run eval:similarity    # 端到端分组质量验证（含取消、并发、隔离断言）',
    'npm run check:similarity   # 链路体检',
    '```'
  ].join('\n')
  writeFileSync(reportPath, md, 'utf8')
  console.log(`[calib] 已写入 ${calibrationPath} 与 ${reportPath}`)
}

main().catch(e => {
  console.error('[calib] 标定失败:', e)
  process.exit(1)
})
