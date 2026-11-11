/**
 * 构建图片分类评估集：从 Wikimedia Commons 搜索公开图片，写入带标签的 manifest。
 *
 * 用法：
 *   node scripts/bootstrap-classification-fixtures.mjs --dry-run   # 仅列出候选标题，不下载
 *   node scripts/bootstrap-classification-fixtures.mjs             # 下载并生成 manifest
 *   node scripts/bootstrap-classification-fixtures.mjs --force     # 忽略已有文件重新下载
 *
 * 说明：Node 原生 fetch 在本机代理环境下不可用，统一走 curl（与下载模型一致）。
 * 生成的 tests/fixtures/manifest.json 是评估的唯一标签来源，便于人工复核与剔除脏样本。
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'fs'
import { execFileSync, execFile } from 'child_process'
import { promisify } from 'util'
import { join, dirname, extname, relative } from 'path'
import { fileURLToPath } from 'url'

const execFileAsync = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = join(root, 'tests', 'fixtures', 'images')
const manifestPath = join(root, 'tests', 'fixtures', 'manifest.json')
const candidatesPath = join(root, 'tests', 'fixtures', 'candidates.json')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FORCE = args.includes('--force')

/** 每类多条查询，尽量覆盖该类的不同视觉形态；标题里出现 DENY 词的直接丢弃 */
const QUERIES = {
  person: {
    terms: ['portrait photograph person face', 'group of people photograph', 'street portrait human'],
    deny: /logo|icon|diagram|map|chart|painting|drawing|silhouette|avatar|placeholder/i
  },
  animal: {
    terms: ['dog photograph', 'cat photograph', 'wild animal zoo photograph', 'bird wildlife photograph'],
    deny: /logo|icon|diagram|map|chart|painting|drawing|cartoon|sketch|toy|statue/i
  },
  landscape: {
    terms: ['mountain landscape photograph', 'lake forest landscape photograph', 'beach sunset landscape photograph'],
    deny: /logo|icon|diagram|map|chart|painting|drawing|panorama.*map/i
  },
  urban: {
    terms: ['city skyline photograph', 'street buildings city photograph', 'skyscraper architecture photograph'],
    deny: /logo|icon|diagram|map|chart|blueprint|model|painting|drawing/i
  },
  indoor: {
    terms: ['living room interior photograph', 'bedroom interior photograph', 'office room interior photograph'],
    deny: /logo|icon|diagram|map|chart|floor plan|blueprint|painting|drawing/i
  },
  food: {
    terms: ['food on plate photograph', 'cake dessert photograph', 'cooked meal dish photograph'],
    deny: /logo|icon|diagram|map|chart|painting|drawing|recipe|menu/i
  },
  vehicle: {
    terms: ['car automobile photograph', 'airplane aircraft photograph', 'train railway photograph', 'ship boat photograph'],
    deny: /logo|icon|diagram|map|chart|painting|drawing|toy|model/i
  },
  document: {
    terms: ['screenshot software interface', 'screenshot website page', 'printed book page text', 'newspaper page scan'],
    deny: /logo|icon|photograph of a person|painting/i
  },
  other: {
    terms: ['abstract texture pattern photograph', 'product on white background', 'sculpture art object photograph'],
    deny: /logo|icon|diagram|map|chart/i
  }
}

const TARGET_PER_CATEGORY = 18
const API = 'https://commons.wikimedia.org/w/api.php'

/** 人工审阅 dry-run 标题后登记的脏样本（绘画、解剖标本、纯文字、含双主体等） */
const EXCLUDE = [
  /^Sun dog\b/i,
  /Dog heart/i,
  /Human.canine friendship/i,
  /This Person Does Not Exist/i,
  /after a photograph by Nadar/i,
  /Alfred de Br/i,
  /Edvard Munch/i,
  /NARA/i,
  /\(page \d+\)/i,
  /Picker Online/i,
  /Open refrigerator/i,
  /Empty Food plate/i,
  /Skylight in the abandoned/i,
  /FEMA - /i,
  /Potsdam Conference/i,
  /Russian Imperial Family/i,
  /Farmers' Protest/i,
  /Broke, baby sick/i,
  /Dorothea Lange atop/i,
  /Woman worker in the Douglas/i,
  /Green Flag West/i,
  /Japanese car accident/i,
  /Car radio antenna/i,
  /NASA's Shuttle Carrier Aircraft/i
]

/** 同一条查询最多取几张，避免同一系列的近重复图片在评估集里过度加权 */
const PER_QUERY_LIMIT = 5

function sleep(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) { /* 同步等待，避免 API 限流 */ }
}

function curlJson(params) {
  const argv = ['-s', '--max-time', '25', '-G', API]
  for (const [k, v] of Object.entries(params)) {
    argv.push('--data-urlencode', `${k}=${v}`)
  }
  let lastErr
  for (let attempt = 0; attempt < 5; attempt++) {
    const out = execFileSync('curl', argv, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    try {
      return JSON.parse(out)
    } catch (e) {
      lastErr = new Error(`API 返回非 JSON（限流？）: ${out.slice(0, 60)}`)
      sleep(2000 * (attempt + 1))
    }
  }
  throw lastErr
}

/** 并发下载，避免串行等待（单张缩略图常需数秒） */
async function curlBinaryAsync(url, dest) {
  await execFileAsync('curl', [
    '-fLsS', '--retry', '3', '--retry-all-errors', '--retry-delay', '1',
    '--connect-timeout', '15', '--max-time', '60',
    '-A', 'fileDeal-eval/1.0', '-o', dest, url
  ], { maxBuffer: 1024 * 1024 })
}

const DOWNLOAD_CONCURRENCY = 8

/** 查询之间留出间隔，Wikimedia 对高频请求会返回纯文本限流提示 */
let lastQueryAt = 0
function search(term, limit = 12) {
  const wait = 1500 - (Date.now() - lastQueryAt)
  if (wait > 0) sleep(wait)
  lastQueryAt = Date.now()
  const j = curlJson({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${term}`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|mime|size',
    iiurlwidth: '384'
  })
  return Object.values(j.query?.pages || {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map(p => ({
      title: (p.title || '').replace(/^File:/, ''),
      url: p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url || '',
      mime: p.imageinfo?.[0]?.mime || '',
      width: p.imageinfo?.[0]?.width || 0,
      height: p.imageinfo?.[0]?.height || 0
    }))
}

function usable(item, cfg) {
  if (!item.url || !/^image\/(jpeg|png)$/.test(item.mime)) return false
  if (!/\.(jpe?g|png)$/i.test(item.title)) return false
  if (item.width < 320 || item.height < 240) return false
  if (cfg.deny.test(item.title)) return false
  if (EXCLUDE.some(re => re.test(item.title))) return false
  if (/[?&]/.test(item.url) && !item.url.includes('thumb')) return false
  return true
}

function collectCandidates() {
  if (!FORCE && existsSync(candidatesPath)) {
    try {
      const cached = JSON.parse(readFileSync(candidatesPath, 'utf8'))
      if (cached && Object.keys(cached).length === Object.keys(QUERIES).length) {
        console.log('[fixtures] 复用已缓存的候选清单')
        for (const [cat, list] of Object.entries(cached)) {
          console.log(`[fixtures] ${cat}: ${list.length} 个候选`)
          if (DRY_RUN) for (const it of list) console.log(`    ${it.title.slice(0, 100)}`)
        }
        return cached
      }
    } catch { /* 缓存损坏则重新查询 */ }
  }

  const collected = {}
  for (const [cat, cfg] of Object.entries(QUERIES)) {
    const seen = new Set()
    const items = []
    for (const term of cfg.terms) {
      let candidates = []
      try {
        candidates = search(term, 10)
      } catch (e) {
        console.warn(`[fixtures] 查询失败 ${cat} / ${term}: ${e.message}`)
        continue
      }
      let taken = 0
      for (const c of candidates) {
        if (items.length >= TARGET_PER_CATEGORY || taken >= PER_QUERY_LIMIT) break
        if (seen.has(c.title) || !usable(c, cfg)) continue
        seen.add(c.title)
        items.push({ ...c, query: term })
        taken++
      }
      if (items.length >= TARGET_PER_CATEGORY) break
    }
    collected[cat] = items
    console.log(`[fixtures] ${cat}: ${items.length} 个候选`)
    if (DRY_RUN) {
      for (const it of items) console.log(`    ${it.title.slice(0, 100)}`)
    }
  }
  mkdirSync(dirname(candidatesPath), { recursive: true })
  writeFileSync(candidatesPath, JSON.stringify(collected, null, 2), 'utf8')
  return collected
}

async function main() {
  const collected = collectCandidates()

  if (DRY_RUN) {
    console.log('\n[dry-run] 仅列出候选，未下载。请审阅标题后去掉 --dry-run 执行。')
    return
  }

  const tasks = []
  const manifest = []
  for (const [cat, items] of Object.entries(collected)) {
    const dir = join(fixtureRoot, cat)
    mkdirSync(dir, { recursive: true })
    for (const [i, item] of items.entries()) {
      const ext = /\.png$/i.test(item.title) ? '.png' : '.jpg'
      const dest = join(dir, `sample_${String(i).padStart(2, '0')}${ext}`)
      const rel = relative(root, dest).split('\\').join('/')
      tasks.push({ category: cat, item, dest, rel })
    }
  }

  let cursor = 0
  let done = 0
  const perCategory = {}
  async function worker() {
    while (cursor < tasks.length) {
      const task = tasks[cursor++]
      const { category, item, dest, rel } = task
      let ok = false
      if (!FORCE && existsSync(dest) && statSync(dest).size > 1000) {
        ok = true
      } else {
        try {
          await curlBinaryAsync(item.url, dest)
          if (!existsSync(dest) || statSync(dest).size < 1000) throw new Error('文件过小')
          ok = true
        } catch (e) {
          console.warn(`[fixtures] 跳过 ${category} / ${item.title.slice(0, 60)}: ${String(e.message).slice(0, 80)}`)
        }
      }
      if (ok) {
        manifest.push({ category, file: rel, title: item.title, source: item.url })
        perCategory[category] = (perCategory[category] || 0) + 1
      }
      done++
      if (done % 25 === 0 || done === tasks.length) {
        console.log(`[fixtures] 下载进度 ${done}/${tasks.length}`)
      }
    }
  }

  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, () => worker()))
  for (const [cat, n] of Object.entries(perCategory)) console.log(`[fixtures] ${cat}: 保存 ${n} 张`)

  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(manifestPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: 'Wikimedia Commons (search API, 384px thumbnails)',
    note: '人工复核 title 后可删除错误样本；评估脚本以本文件为标签来源',
    count: manifest.length,
    items: manifest
  }, null, 2), 'utf8')
  console.log(`[fixtures] 共 ${manifest.length} 张，manifest: ${manifestPath}`)
}

main().catch(e => {
  console.error('[fixtures] 失败:', e)
  process.exit(1)
})
