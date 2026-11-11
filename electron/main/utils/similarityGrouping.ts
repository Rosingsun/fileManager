import type {
  ImageHash,
  SimilarityGroup,
  SimilarityPairScore,
  SimilarityTier,
  SimilarityDetectionMode
} from '../../../src/types'
import {
  compareFingerprints,
  cosineSimilarity,
  recommendKeepImage,
  type ImageFingerprint,
  type SimilarityCalibration
} from './similarityUtils'

/** 单张图的全部中间结果（评估脚本与运行时共用） */
export interface FingerprintRecord {
  filePath: string
  fileHash: string
  size: number
  modifiedTime: number
  width?: number
  height?: number
  sharpness?: number
  decodeError?: string
  fp?: ImageFingerprint
  /** CLIP 视觉嵌入（已 L2 归一化），仅 scene 档需要 */
  clipEmb?: Float32Array
}

export interface GroupOptions {
  mode: SimilarityDetectionMode
  threshold: number
  calibration: SimilarityCalibration
  onProgress?: (percent: number, label: string) => void
  isCancelled?: () => boolean
}

export interface GroupResult {
  groups: SimilarityGroup[]
  pairsCompared: number
  exactGroups: number
  nearGroups: number
  sceneGroups: number
}

class DSU {
  private parent: Int32Array
  private rank: Uint8Array

  constructor(n: number) {
    this.parent = new Int32Array(n)
    this.rank = new Uint8Array(n)
    for (let i = 0; i < n; i++) this.parent[i] = i
  }

  find(x: number): number {
    let r = x
    while (this.parent[r] !== r) r = this.parent[r]
    while (this.parent[x] !== x) {
      const next = this.parent[x]
      this.parent[x] = r
      x = next
    }
    return r
  }

  union(a: number, b: number): boolean {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return false
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra
    else {
      this.parent[rb] = ra
      this.rank[ra]++
    }
    return true
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

function toImageHash(r: FingerprintRecord): ImageHash {
  return {
    filePath: r.filePath,
    fileHash: r.fileHash,
    width: r.width,
    height: r.height,
    size: r.size,
    modifiedTime: r.modifiedTime,
    sharpness: r.sharpness,
    decodeError: r.decodeError
  }
}

const MAX_PAIRS_PER_GROUP = 12

function buildGroup(
  members: FingerprintRecord[],
  edges: SimilarityPairScore[],
  tier: SimilarityTier,
  id: string
): SimilarityGroup {
  const scores = edges.length ? edges.reduce((s, e) => s + e.score, 0) / edges.length : 100
  const images = members.map(toImageHash)
  const topEdges = [...edges].sort((a, b) => b.score - a.score).slice(0, MAX_PAIRS_PER_GROUP)
  const reason =
    tier === 'exact'
      ? '文件内容完全一致（MD5 相同）'
      : tier === 'near'
        ? '感知指纹高度一致：DCT 感知哈希 + 梯度哈希 + 颜色布局 + 宽高比'
        : 'CLIP 语义相近（同场景/不同裁剪），仅供参考，不构成重复判断'

  return {
    id,
    images,
    similarity: Math.round(scores * 100) / 100,
    tier,
    safeToDelete: tier !== 'scene',
    recommendedKeep: recommendKeepImage(images),
    pairScores: topEdges,
    reason
  }
}

/**
 * 并查集连通分量分组。
 *  exact/near 边先合并为「安全组」；scene 语义组只在未被安全组收录的图片之间生成，
 *  因此 scene 组与可删除组永不交叉，批量删除不可能误删同场景照片。
 */
export async function groupFingerprints(
  records: FingerprintRecord[],
  options: GroupOptions
): Promise<GroupResult> {
  const { mode, threshold, calibration, onProgress, isCancelled } = options
  // 硬门控基准必须与用户滑块阈值一致，否则放宽阈值时门控失效
  const cal: SimilarityCalibration = { ...calibration, threshold }
  const valid = records.filter(r => !!r.fp)
  const n = valid.length
  const dsu = new DSU(n)
  // 全局边列表：并查集 union 会改变 root，按最终成员集合筛选比按 root 存边更可靠
  const allEdges: SimilarityPairScore[] = []
  let pairsCompared = 0

  // ---- 1. exact：MD5 分桶，O(n)
  const md5Buckets = new Map<string, number[]>()
  for (let i = 0; i < n; i++) {
    const list = md5Buckets.get(valid[i].fileHash)
    if (list) list.push(i)
    else md5Buckets.set(valid[i].fileHash, [i])
  }
  for (const list of md5Buckets.values()) {
    if (list.length < 2) continue
    for (let k = 1; k < list.length; k++) {
      dsu.union(list[0], list[k])
      allEdges.push({
        a: valid[list[0]].filePath,
        b: valid[list[k]].filePath,
        score: 100,
        tier: 'exact'
      })
    }
  }

  // ---- 2. near：感知指纹两两比较（整数位运算，分批让出事件循环）
  const useNear = mode !== 'exact'
  if (useNear && n > 1) {
    const totalPairs = (n * (n - 1)) / 2
    let done = 0
    let lastReport = 0
    for (let i = 0; i < n; i++) {
      if (isCancelled?.()) break
      const a = valid[i]
      for (let j = i + 1; j < n; j++) {
        const b = valid[j]
        const sim = compareFingerprints(a.fp!, b.fp!, cal)
        if (sim.score >= threshold) {
          dsu.union(i, j)
          allEdges.push({
            a: a.filePath,
            b: b.filePath,
            score: Math.round(sim.score * 100) / 100,
            tier: 'near',
            breakdown: {
              pHash: Math.round(sim.pHashSim * 10) / 10,
              dHash: Math.round(sim.dHashSim * 10) / 10,
              color: Math.round(sim.colorSim * 10) / 10,
              aspect: Math.round(sim.aspectSim * 10) / 10
            }
          })
        }
        done++
        pairsCompared++
      }
      if (done - lastReport >= 4000 || i === n - 1) {
        lastReport = done
        onProgress?.(Math.min(100, Math.round((done / totalPairs) * 100)), '比对感知指纹')
        await yieldToEventLoop()
      }
    }
  }

  // ---- 3. 收集安全组（tier：含 near 边则 near，否则 exact）
  const safeBuckets = new Map<number, FingerprintRecord[]>()
  for (let i = 0; i < n; i++) {
    const root = dsu.find(i)
    const list = safeBuckets.get(root)
    if (list) list.push(valid[i])
    else safeBuckets.set(root, [valid[i]])
  }
  const groups: SimilarityGroup[] = []
  const groupedPaths = new Set<string>()
  let exactGroups = 0
  let nearGroups = 0

  for (const [, members] of safeBuckets) {
    const memberPaths = new Set(members.map(m => m.filePath))
    const edges = allEdges.filter(
      e => e.tier !== 'scene' && memberPaths.has(e.a) && memberPaths.has(e.b)
    )
    if (members.length < 2 || edges.length === 0) continue
    const tier: SimilarityTier = edges.every(e => e.tier === 'exact') ? 'exact' : 'near'
    groups.push(buildGroup(members, edges, tier, `group-${groups.length + 1}`))
    members.forEach(m => groupedPaths.add(m.filePath))
    if (tier === 'exact') exactGroups++
    else nearGroups++
  }

  // ---- 4. scene：仅未进入安全组的图片参与，独立 DSU，永不与可删除组交叉
  let sceneGroups = 0
  if (mode === 'scene' && !isCancelled?.()) {
    const sceneCandidates = valid.filter(
      r => !groupedPaths.has(r.filePath) && r.clipEmb && r.clipEmb.length > 0
    )
    const m = sceneCandidates.length
    if (m > 1) {
      const sceneDsu = new DSU(m)
      const sceneEdges: SimilarityPairScore[] = []
      const semThreshold = calibration.semanticThreshold
      let done = 0
      let lastReport = 0
      const total = (m * (m - 1)) / 2
      for (let i = 0; i < m; i++) {
        if (isCancelled?.()) break
        const a = sceneCandidates[i].clipEmb!
        for (let j = i + 1; j < m; j++) {
          const cos = cosineSimilarity(a, sceneCandidates[j].clipEmb!)
          if (cos >= semThreshold) {
            sceneDsu.union(i, j)
            sceneEdges.push({
              a: sceneCandidates[i].filePath,
              b: sceneCandidates[j].filePath,
              score: Math.round(cos * 10000) / 100,
              tier: 'scene',
              breakdown: { semantic: Math.round(cos * 10000) / 100 }
            })
          }
          done++
        }
        if (done - lastReport >= 2000 || i === m - 1) {
          lastReport = done
          onProgress?.(Math.min(100, Math.round((done / total) * 100)), '比对 CLIP 语义')
          await yieldToEventLoop()
        }
      }
      const sceneBuckets = new Map<number, FingerprintRecord[]>()
      for (let i = 0; i < m; i++) {
        const root = sceneDsu.find(i)
        const list = sceneBuckets.get(root)
        if (list) list.push(sceneCandidates[i])
        else sceneBuckets.set(root, [sceneCandidates[i]])
      }
      for (const [, members] of sceneBuckets) {
        const memberPaths = new Set(members.map(mem => mem.filePath))
        const edges = sceneEdges.filter(e => memberPaths.has(e.a) && memberPaths.has(e.b))
        if (members.length < 2 || edges.length === 0) continue
        groups.push(buildGroup(members, edges, 'scene', `group-${groups.length + 1}`))
        sceneGroups++
      }
    }
  }

  // 强档优先：exact → near → scene；同档按组内相似度降序
  const tierOrder: Record<SimilarityTier, number> = { exact: 0, near: 1, scene: 2 }
  groups.sort(
    (a, b) => tierOrder[a.tier] - tierOrder[b.tier] || b.similarity - a.similarity
  )
  groups.forEach((g, i) => {
    g.id = `group-${i + 1}`
  })

  return { groups, pairsCompared, exactGroups, nearGroups, sceneGroups }
}
