/**
 * 提取评估集的模型中间特征（CLIP 图像嵌入 + ImageNet 九类概率），供参数标定使用。
 *
 * 用法：npx tsx scripts/extract-classification-features.ts [--limit N] [--reuse]
 * 输出：tests/fixtures/features.json
 *
 * 说明：这是开发期工具，不参与运行时。把耗时的模型推理结果缓存后，
 * calibrate-classification.mjs 可以在秒级内做网格搜索与 K 折交叉验证。
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { preprocessMultiCrop } from '../electron/main/utils/classificationPreprocess'
import {
  getModelsDir,
  getClassificationModelPath,
  type ClassificationModelId
} from '../electron/main/utils/classificationModels'
import {
  getClipSession,
  encodeClipImagePixels,
  averageClipEmbeddings
} from '../electron/main/utils/clipClassifier'
import {
  runImagenetFallback,
  loadImagenetLabels
} from '../electron/main/classification/imagenetFallback'

const root = process.cwd()
const manifestPath = join(root, 'tests', 'fixtures', 'manifest.json')
const featuresPath = join(root, 'tests', 'fixtures', 'features.json')

const args = process.argv.slice(2)
const limitArg = args.indexOf('--limit')
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) || 0 : 0
const REUSE = args.includes('--reuse')

const CLIP_RUNS: Array<{ key: string; modelId: ClassificationModelId; crops: number }> = [
  { key: 'accuracy_fast', modelId: 'clip_vit_b32_quant', crops: 1 },
  { key: 'accuracy_max', modelId: 'clip_vit_l14_quant', crops: 5 }
]

const INET_RUNS: Array<{ key: string; modelId: ClassificationModelId; crops: number }> = [
  { key: 'mobilenetv2', modelId: 'mobilenetv2', crops: 1 },
  { key: 'efficientnet_b4', modelId: 'efficientnet_b4', crops: 5 }
]

interface FeatureItem {
  file: string
  expected: string
  clip: Record<string, number[]>
  imagenet: Record<string, Record<string, number> | null>
}

function loadItems(): Array<{ file: string; expected: string }> {
  if (!existsSync(manifestPath)) {
    throw new Error(`缺少 ${manifestPath}，请先运行 node scripts/bootstrap-classification-fixtures.mjs`)
  }
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const items = (m.items || [])
    .map((it: { file: string; category: string }) => ({ file: it.file, expected: it.category }))
    .filter((it: { file: string }) => existsSync(join(root, it.file)))
  return LIMIT > 0 ? items.slice(0, LIMIT) : items
}

/** manifest 里存相对路径，保证评估集可跨机器复现 */
function resolveFile(rel: string): string {
  return join(root, rel)
}

async function main() {
  const items = loadItems()
  console.log(`[features] 图片数 ${items.length}，输出 ${featuresPath}`)
  if (!items.length) throw new Error('评估集为空')

  const existing: Record<string, FeatureItem> = {}
  if (REUSE && existsSync(featuresPath)) {
    const old = JSON.parse(readFileSync(featuresPath, 'utf8'))
    for (const it of old.items || []) existing[it.file] = it
    console.log(`[features] 复用已有特征 ${Object.keys(existing).length} 条`)
  }

  const modelsDir = getModelsDir(root)
  const labels = loadImagenetLabels(root)

  const clipSessions = new Map<string, Awaited<ReturnType<typeof getClipSession>>>()
  for (const run of CLIP_RUNS) {
    const p = getClassificationModelPath(run.modelId, root)
    const s = await getClipSession(p)
    if (!s) throw new Error(`CLIP 模型不可用: ${p}`)
    clipSessions.set(run.key, s)
    console.log(`[features] 已加载 ${run.key} 视觉模型 (${p.split(/[/\\]/).pop()})`)
  }
  for (const run of INET_RUNS) {
    const p = getClassificationModelPath(run.modelId, root)
    if (!existsSync(p)) console.warn(`[features] ImageNet 模型缺失，将跳过: ${p}`)
  }

  const out: FeatureItem[] = []
  const started = Date.now()
  for (const [idx, item] of items.entries()) {
    const cached = existing[item.file]
    const clip: Record<string, number[]> = cached?.clip ? { ...cached.clip } : {}
    const imagenet: Record<string, Record<string, number> | null> = cached?.imagenet
      ? { ...cached.imagenet }
      : {}

    for (const run of CLIP_RUNS) {
      if (clip[run.key]?.length) continue
      const session = clipSessions.get(run.key)!
      const imagePath = resolveFile(item.file)
      const crops = await preprocessMultiCrop(imagePath, 224, 'clip', run.crops)
      const embs = []
      for (const pixels of crops) {
        const e = await encodeClipImagePixels(session, pixels, 224)
        if (e) embs.push(e)
      }
      const avg = averageClipEmbeddings(embs)
      if (!avg) throw new Error(`CLIP 推理失败: ${item.file} / ${run.key}`)
      clip[run.key] = Array.from(avg)
    }

    for (const run of INET_RUNS) {
      if (imagenet[run.key] !== undefined) continue
      const p = getClassificationModelPath(run.modelId, root)
      if (!existsSync(p)) {
        imagenet[run.key] = null
        continue
      }
      try {
        imagenet[run.key] = await runImagenetFallback(
          resolveFile(item.file),
          root,
          run.modelId,
          labels,
          run.crops
        )
      } catch (e) {
        console.warn(`[features] ImageNet 跳过 ${item.file} / ${run.key}:`, (e as Error).message)
        imagenet[run.key] = null
      }
    }

    out.push({ file: item.file, expected: item.expected, clip, imagenet })
    if ((idx + 1) % 10 === 0 || idx === items.length - 1) {
      const sec = ((Date.now() - started) / 1000).toFixed(0)
      console.log(`[features] ${idx + 1}/${items.length}  ${sec}s`)
    }
  }

  writeFileSync(featuresPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: '开发期中间特征缓存；clip 为 L2 归一化图像嵌入，imagenet 为聚合后的九类概率',
    clipRuns: CLIP_RUNS,
    imagenetRuns: INET_RUNS,
    count: out.length,
    items: out
  }), 'utf8')
  console.log(`[features] 完成，共 ${out.length} 条 → ${featuresPath}`)
}

main().catch(e => {
  console.error('[features] 失败:', e)
  process.exit(1)
})
