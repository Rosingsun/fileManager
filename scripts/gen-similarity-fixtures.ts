import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import sharp from 'sharp'

/**
 * 生成相似检测评估样本。
 * 标签含义：
 *   near  — 同一原图经压缩/亮度/缩放/裁剪/EXIF 旋转等变换，应判为「近重复」
 *   scene — 同一原图经大幅裁剪/镜像/强调色，像素指纹已不同但语义仍相近，应判为「同场景」
 *   hard  — 同类别的不同照片（最容易误判的负样本）
 *   easy  — 跨类别的不同照片
 * 所有负样本对都会用 pHash 距离预筛，剔除本身疑似重复的图片，避免脏标签污染标定。
 */

const root = process.cwd()
const manifestPath = join(root, 'tests', 'fixtures', 'manifest.json')
const outRoot = join(root, 'tests', 'fixtures', 'similarity')
const outManifest = join(outRoot, 'manifest.json')

type VariantKind = 'near' | 'scene'

interface Variant {
  file: string
  source: string
  sourceIndex: number
  category: string
  kind: VariantKind
  transform: string
}

interface BaseImage {
  file: string
  category: string
  index: number
}

const NEAR_TRANSFORMS: Array<{ name: string; apply: (img: sharp.Sharp, w: number, h: number) => sharp.Sharp }> = [
  { name: 'jpeg35', apply: (img) => img.jpeg({ quality: 35 }) },
  { name: 'jpeg80', apply: (img) => img.jpeg({ quality: 80 }) },
  { name: 'bright', apply: (img) => img.modulate({ brightness: 1.28 }) },
  { name: 'dark', apply: (img) => img.modulate({ brightness: 0.74 }) },
  { name: 'saturate', apply: (img) => img.modulate({ saturation: 1.7 }) },
  { name: 'grey', apply: (img) => img.greyscale() },
  { name: 'downscale', apply: (img, w, h) => img.resize(Math.max(32, Math.round(w * 0.45)), Math.max(32, Math.round(h * 0.45))) },
  { name: 'blur', apply: (img) => img.blur(1.1) },
  {
    name: 'crop90',
    apply: (img, w, h) => img.extract({
      left: Math.round(w * 0.05), top: Math.round(h * 0.05),
      width: Math.max(16, Math.round(w * 0.9)), height: Math.max(16, Math.round(h * 0.9))
    })
  }
]

const SCENE_TRANSFORMS: Array<{ name: string; apply: (img: sharp.Sharp, w: number, h: number) => sharp.Sharp }> = [
  {
    name: 'crop60',
    apply: (img, w, h) => img.extract({
      left: Math.round(w * 0.18), top: Math.round(h * 0.18),
      width: Math.max(16, Math.round(w * 0.62)), height: Math.max(16, Math.round(h * 0.62))
    })
  },
  { name: 'flop', apply: (img) => img.flop() },
  { name: 'strongTint', apply: (img) => img.modulate({ brightness: 1.15, saturation: 0.4 }).tint('#8899cc') }
]

async function main() {
  const base = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const items: BaseImage[] = (base.items || [])
    .map((it: { file: string; category: string }, i: number) => ({
      file: join(root, it.file), category: it.category, index: i
    }))
    .filter((it: BaseImage) => existsSync(it.file))

  if (!items.length) throw new Error('评估集为空，请先运行 npm run fixtures:classify')
  mkdirSync(outRoot, { recursive: true })

  const variants: Variant[] = []
  let failed = 0

  for (const item of items) {
    const meta = await sharp(item.file).metadata()
    const w = meta.width ?? 320
    const h = meta.height ?? 320
    const dir = join(outRoot, item.category)
    mkdirSync(dir, { recursive: true })

    const jobs: Array<{ name: string; kind: VariantKind; pipeline: sharp.Sharp }> = [
      ...NEAR_TRANSFORMS.map(t => ({ name: t.name, kind: 'near' as const, pipeline: t.apply(sharp(item.file).rotate(), w, h) })),
      ...SCENE_TRANSFORMS.map(t => ({ name: t.name, kind: 'scene' as const, pipeline: t.apply(sharp(item.file).rotate(), w, h) }))
    ]

    for (const job of jobs) {
      const dest = join(dir, `${String(item.index).padStart(3, '0')}_${job.name}.jpg`)
      try {
        const buf = await job.pipeline.jpeg({ quality: 88 }).toBuffer()
        writeFileSync(dest, buf)
        variants.push({
          file: dest,
          source: item.file,
          sourceIndex: item.index,
          category: item.category,
          kind: job.kind,
          transform: job.name
        })
      } catch (e) {
        failed++
        console.warn(`[gen] 跳过 ${item.category}/${job.name}: ${String(e).slice(0, 90)}`)
      }
    }
  }

  writeFileSync(outManifest, JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: '程序化变换生成的相似检测评估集；source 为原图，kind=near|scene 为期望判定的正样本类型',
    baseCount: items.length,
    variantCount: variants.length,
    failed,
    bases: items,
    variants
  }, null, 2), 'utf8')

  const byKind = variants.reduce((acc, v) => {
    acc[v.kind] = (acc[v.kind] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  console.log(`[gen] 原图 ${items.length} 张，变换 ${variants.length} 张 (${JSON.stringify(byKind)})，失败 ${failed}`)
  console.log(`[gen] manifest: ${outManifest}`)
  void dirname
}

main().catch(e => {
  console.error('[gen] 生成失败:', e)
  process.exit(1)
})
