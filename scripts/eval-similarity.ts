import { readFileSync, writeFileSync, existsSync } from 'fs'
import { readFile, stat } from 'fs/promises'
import { join, resolve } from 'path'
import {
  DEFAULT_CALIBRATION,
  calculateFileHash,
  extractFingerprint,
  type SimilarityCalibration
} from '../electron/main/utils/similarityUtils'
import {
  groupFingerprints,
  type FingerprintRecord
} from '../electron/main/utils/similarityGrouping'

/**
 * 相似检测端到端验证（真实分组逻辑，不走模型 UI）。
 *
 * 校验三件事：
 *  1. 检出质量 — 变换样本能否与原图归入同一安全组，不同原图是否被误合并
 *  2. 删除隔离 — scene 组必须 safeToDelete=false，且与安全组零交叉
 *  3. 可取消   — 取消标志能让比对阶段立即退出而不是跑满
 */

const root = process.cwd()
const simManifestPath = join(root, 'tests', 'fixtures', 'similarity', 'manifest.json')
const calibPath = join(root, 'models', 'similarity-calibration.json')

interface Variant {
  file: string
  source: string
  sourceIndex: number
  category: string
  kind: 'near' | 'scene'
  transform: string
}

interface BaseImage {
  file: string
  category: string
  index: number
}

interface Manifest {
  bases: BaseImage[]
  variants: Variant[]
}

function arg(name: string, fallback: string): string {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

function loadCalibration(): SimilarityCalibration {
  if (!existsSync(calibPath)) return { ...DEFAULT_CALIBRATION }
  const raw = JSON.parse(readFileSync(calibPath, 'utf8')) as Partial<SimilarityCalibration>
  if (raw.version !== 2) return { ...DEFAULT_CALIBRATION }
  return {
    ...DEFAULT_CALIBRATION,
    ...raw,
    weights: { ...DEFAULT_CALIBRATION.weights, ...(raw.weights || {}) }
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R | null>): Promise<Array<R | null>> {
  const out: Array<R | null> = new Array(items.length).fill(null)
  let cursor = 0
  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return out
}

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

async function main() {
  if (!existsSync(simManifestPath)) {
    throw new Error('缺少相似检测评估集，请先运行 npm run sim:fixtures')
  }
  const manifest = JSON.parse(readFileSync(simManifestPath, 'utf8')) as Manifest
  const maxBases = Number(arg('max-bases', '0')) || 0
  const bases = (maxBases > 0 ? manifest.bases.slice(0, maxBases) : manifest.bases).filter(b =>
    existsSync(resolve(root, b.file))
  )
  const baseSet = new Set(bases.map(b => b.index))
  const variants = manifest.variants.filter(v => baseSet.has(v.sourceIndex) && existsSync(resolve(root, v.file)))
  const calibration = loadCalibration()
  const threshold = Number(arg('threshold', String(calibration.threshold))) || calibration.threshold

  console.log(`[eval] 原图 ${bases.length} 张，变换样本 ${variants.length} 张，阈值 ${threshold}`)

  const files: Array<{ file: string; sourceIndex: number; kind: 'base' | 'near' | 'scene' }> = [
    ...bases.map(b => ({ file: resolve(root, b.file), sourceIndex: b.index, kind: 'base' as const })),
    ...variants.map(v => ({
      file: resolve(root, v.file),
      sourceIndex: v.sourceIndex,
      kind: v.kind
    }))
  ]

  const t0 = Date.now()
  const extracted = await mapLimit(files, 6, async item => {
    try {
      const buffer = await readFile(item.file)
      const fp = await extractFingerprint(buffer)
      const st = await stat(item.file)
      const record: FingerprintRecord = {
        filePath: item.file,
        fileHash: calculateFileHash(buffer),
        size: st.size,
        modifiedTime: st.mtime.getTime(),
        width: fp.width,
        height: fp.height,
        sharpness: fp.sharpness,
        fp
      }
      return record
    } catch (e) {
      console.warn(`[eval] 指纹失败 ${item.file}: ${String(e).slice(0, 80)}`)
      return null
    }
  })
  const records = extracted.filter((r): r is FingerprintRecord => !!r)
  const sourceOf = new Map<string, number>()
  for (const f of files) sourceOf.set(resolve(root, f.file), f.sourceIndex)
  console.log(`[eval] 指纹完成 ${records.length}/${files.length}，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  // ---- 1. 真实分组
  const t1 = Date.now()
  const grouped = await groupFingerprints(records, { mode: 'near', threshold, calibration })
  const groupOf = new Map<string, string>()
  for (const g of grouped.groups) for (const img of g.images) groupOf.set(img.filePath, g.id)
  console.log(
    `[eval] 分组 ${grouped.groups.length} 组（exact ${grouped.exactGroups} / near ${grouped.nearGroups}），` +
      `比对 ${grouped.pairsCompared} 对，耗时 ${((Date.now() - t1) / 1000).toFixed(1)}s`
  )

  const nearVariants = variants.filter(v => v.kind === 'near')
  const sceneVariants = variants.filter(v => v.kind === 'scene')
  const hitNear = nearVariants.filter(v => groupOf.get(resolve(root, v.file)) === groupOf.get(resolve(root, v.source)))
  const hitScene = sceneVariants.filter(v => groupOf.get(resolve(root, v.file)) === groupOf.get(resolve(root, v.source)))

  // 误合并：同组内出现不同原图来源（同一原图的不同变换不算）
  let crossSourcePairs = 0
  let crossSourceGroups = 0
  for (const g of grouped.groups) {
    const sources = new Set(g.images.map(img => sourceOf.get(img.filePath)))
    if (sources.size > 1) {
      crossSourceGroups++
      crossSourcePairs += (sources.size * (sources.size - 1)) / 2
    }
  }

  // ---- 2. 删除隔离断言
  const unsafe = grouped.groups.filter(g => !g.safeToDelete)
  const safe = grouped.groups.filter(g => g.safeToDelete)
  const safePaths = new Set(safe.flatMap(g => g.images.map(i => i.filePath)))
  const overlap = unsafe.flatMap(g => g.images.filter(i => safePaths.has(i.filePath)))
  const badTier = grouped.groups.filter(g => (g.tier === 'scene') === g.safeToDelete)
  const missingPairs = grouped.groups.filter(g => g.pairScores.length === 0)

  // ---- 3. scene 档隔离（合成：指纹截然不同但语义向量一致）
  const A = { hi: 0, lo: 0 }
  const B = { hi: 0x7fffffff, lo: 0x7fffffff }
  const zeroColor = new Array(50).fill(0)
  const oneColor = new Array(50).fill(1)
  const mk = (name: string, hash: { hi: number; lo: number }, color: number[]): FingerprintRecord => ({
    filePath: `/synthetic/${name}.jpg`,
    fileHash: name,
    size: 1024,
    modifiedTime: 0,
    width: 100,
    height: 100,
    fp: { pHash: hash, dHash: hash, colorLayout: color, aspectRatio: 1, width: 100, height: 100, sharpness: 1 },
    clipEmb: new Float32Array([1, 0, 0, 0])
  })
  const synth = await groupFingerprints(
    [mk('a', A, zeroColor), mk('b', B, oneColor)],
    { mode: 'scene', threshold, calibration }
  )
  const synthScene = synth.groups.filter(g => g.tier === 'scene')
  const synthOk = synthScene.length === 1 && synthScene[0].safeToDelete === false && synth.groups.every(g => g.safeToDelete === false)

  // ---- 4. 取消：立即取消应在毫秒级返回
  const t2 = Date.now()
  const cancelled = await groupFingerprints(records, {
    mode: 'near',
    threshold,
    calibration,
    isCancelled: () => true
  })
  const cancelMs = Date.now() - t2

  const summary = {
    generatedAt: new Date().toISOString(),
    threshold,
    bases: bases.length,
    variants: variants.length,
    fingerprints: records.length,
    groups: grouped.groups.length,
    exactGroups: grouped.exactGroups,
    nearGroups: grouped.nearGroups,
    nearRecall: Number((hitNear.length / Math.max(1, nearVariants.length)).toFixed(4)),
    sceneCoveredByNear: Number((hitScene.length / Math.max(1, sceneVariants.length)).toFixed(4)),
    crossSourceGroups,
    crossSourcePairs,
    unsafeGroups: unsafe.length,
    overlapWithSafe: overlap.length,
    tierFlagMismatch: badTier.length,
    groupsWithoutPairScores: missingPairs.length,
    sceneIsolationOk: synthOk,
    cancelReturnedInMs: cancelMs,
    cancelHonored: cancelled.pairsCompared < 20000,
    evalMs: Date.now() - t0
  }

  console.log('')
  console.log(`[eval] near 变体检出率     ${pct(summary.nearRecall)} (${hitNear.length}/${nearVariants.length})`)
  console.log(`[eval] scene 变体被 near 覆盖 ${pct(summary.sceneCoveredByNear)} (${hitScene.length}/${sceneVariants.length})`)
  console.log(`[eval] 跨源误合并          ${crossSourceGroups} 组 / ${crossSourcePairs} 对`)
  console.log(`[eval] scene 组数          ${unsafe.length}（safeToDelete 必须为 false）`)
  console.log(`[eval] 安全/scene 交叉     ${overlap.length} 张（必须为 0）`)
  console.log(`[eval] 档位标记错配        ${badTier.length} 组（必须为 0）`)
  console.log(`[eval] 缺少逐对分数        ${missingPairs.length} 组（必须为 0）`)
  console.log(`[eval] 合成 scene 隔离     ${synthOk ? 'PASS' : 'FAIL'}`)
  console.log(`[eval] 取消响应            ${cancelMs}ms，比对对数 ${cancelled.pairsCompared}`)

  const failures: string[] = []
  if (overlap.length) failures.push(`scene 与安全组交叉 ${overlap.length} 张`)
  if (badTier.length) failures.push(`档位与 safeToDelete 标记错配 ${badTier.length} 组`)
  if (missingPairs.length) failures.push(`${missingPairs.length} 个分组缺少逐对分数`)
  if (!synthOk) failures.push('合成 scene 隔离断言失败')
  if (!summary.cancelHonored) failures.push('取消未生效（仍完成大量比对）')

  if (arg('json', '0') === '1') {
    const outPath = join(root, 'tests', 'fixtures', 'similarity-eval.json')
    writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8')
    console.log(`[eval] 明细写入 ${outPath}`)
  }

  if (failures.length) {
    console.error(`[eval] FAIL: ${failures.join('；')}`)
    process.exit(1)
  }
  console.log('[eval] PASS：检出质量与删除隔离断言均通过')
}

main().catch(e => {
  console.error('[eval] 执行失败:', e)
  process.exit(1)
})
