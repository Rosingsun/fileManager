import type { ImageContentCategory } from '../../../src/types'

/** ImageNet 千类中 index 0–397 为动植物等生物（398 起为 abacus 等人造物） */
export const IMAGENET_ORGANISM_MAX_INDEX = 397

export function softmax(logits: Float32Array): Float32Array {
  let max = -Infinity
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > max) max = logits[i]
  }
  const out = new Float32Array(logits.length)
  let sum = 0
  for (let i = 0; i < logits.length; i++) {
    const v = Math.exp(logits[i] - max)
    out[i] = v
    sum += v
  }
  for (let i = 0; i < out.length; i++) out[i] /= sum
  return out
}

/** 常见「人身/穿戴/肖像」类 ImageNet 标签（含索引 >397），用于与生物类区分 */
const PERSON_IMAGENET_CUE =
  /\b(academic gown|baseball player|bikini|bow tie|bridegroom|cowboy hat|cowboy boot|crash helmet|diaper|football helmet|gas mask|gown|kimono|lab coat|military cap|military uniform|miniskirt|neck brace|oxygen mask|poncho|poke bonnet|sarong|scuba diver|seat belt|ski mask|sombrero|sunglasses|swimming cap|wig|mask)\b/i

/**
 * 将 ImageNet 千类标签映射到 9 大类（仅用于索引 >= 397 的人造物/场景等）
 */
export function imagenetLabelToNine(label: string): ImageContentCategory {
  const l = label.toLowerCase()

  if (
    /^(baseball player|bridegroom|scuba diver)$/.test(l) ||
    /\b(mannequin)\b/.test(l) ||
    PERSON_IMAGENET_CUE.test(l)
  ) {
    return 'person'
  }

  if (
    /\b(web site|website|menu|crossword|comic book|notebook|monitor|screen|desktop computer|hand-held computer|cellular telephone|remote control|typewriter keyboard|printer|keyboard|mouse|iPod|modem|oscilloscope)\b/.test(l)
  ) {
    return 'document'
  }

  if (
    /\b(car|jeep|minivan|limousine|sports car|convertible|cab|police van|ambulance|fire engine|garbage truck|tow truck|tractor trailer|trailer truck|moving van|minibus|school bus|trolleybus|streetcar|steam locomotive|electric locomotive|bullet train|freight car|passenger car|barrow|shopping cart|motor scooter|forklift|steamroller|bulldozer|snowplow|harvester|thresher|tractor|recreational vehicle|mobile home|tricycle|unicycle|bicycle|mountain bike|ship|lifeboat|fireboat|speedboat|canoe|catamaran|trimaran|container ship|liner|aircraft carrier|submarine|airliner|warplane|space shuttle|missile|rocket|dogsled|palanquin|rickshaw|shopping cart)\b/.test(l)
  ) {
    return 'vehicle'
  }

  if (
    /\b(plate|consomme|hot pot|trifle|ice cream|ice pop|baguette|bagel|pretzel|cheeseburger|hot dog|mashed potato|cabbage|broccoli|cauliflower|zucchini|spaghetti squash|acorn squash|butternut squash|cucumber|artichoke|bell pepper|cardoon|mushroom|granny smith|strawberry|orange|lemon|fig|pineapple|banana|jackfruit|custard apple|pomegranate|carbonara|chocolate syrup|dough|meatloaf|pizza|pot pie|burrito|red wine|espresso|cup|eggnog|guacamole|pretzel|cheeseburger)\b/.test(l) ||
    /\b(wine bottle|beer bottle|beer glass|water bottle|pop bottle|coffee mug|espresso|goblet|measuring cup|pitcher|cocktail shaker|plate|meat loaf|hotdog|pretzel|bagel|cheeseburger|consomme)\b/.test(l)
  ) {
    return 'food'
  }

  if (
    /\b(alp|bubble|cliff|coral reef|geyser|lakeshore|promontory|sandbar|seashore|valley|volcano|rapeseed|hay)\b/.test(l)
  ) {
    return 'landscape'
  }

  if (
    /\b(library|restaurant|cinema|home theater|barbershop|bookstore|butcher shop|confectionery|shoe shop|tobacco shop|toy store|grocery store|palace|monastery|church|mosque|castle|triumphal arch|viaduct|dam|lighthouse|obelisk|bell tower|radio telescope|windmill|apiary|boathouse|greenhouse|tree house|yurt|mobile home)\b/.test(l) ||
    /\b(street sign|traffic light|parking meter|fountain|maypole|maze)\b/.test(l)
  ) {
    return 'urban'
  }

  if (
    /\b(bathtub|shower curtain|four-poster|microwave|oven|refrigerator|dishwasher|washer|iron|vacuum cleaner|sewing machine|toilet seat|cradle|crib|fireplace|studio couch|china cabinet|medicine chest|entertainment center|bookcase|wardrobe|window shade|sliding door|turnstile)\b/.test(l)
  ) {
    return 'indoor'
  }

  return 'other'
}

export function categoryForImagenetIndex(index: number, label: string): ImageContentCategory {
  if (index >= 0 && index <= IMAGENET_ORGANISM_MAX_INDEX) {
    return 'animal'
  }
  return imagenetLabelToNine(label)
}

export type NineProbabilities = Record<ImageContentCategory, number>

const EMPTY_NINE: NineProbabilities = {
  person: 0,
  animal: 0,
  landscape: 0,
  urban: 0,
  indoor: 0,
  food: 0,
  vehicle: 0,
  document: 0,
  other: 0
}

export function aggregateImagenetToNine(
  probs: Float32Array,
  labels: string[]
): NineProbabilities {
  const out: NineProbabilities = { ...EMPTY_NINE }
  const n = Math.min(probs.length, labels.length)
  for (let i = 0; i < n; i++) {
    const cat = categoryForImagenetIndex(i, labels[i])
    out[cat] += probs[i]
  }
  return out
}

/** ImageNet 辅助：动物 / 交通工具 / 文档相关类的索引集合上的概率质量（用于与 CLIP 融合） */
export function imagenetObjectAuxiliaryScores(
  probs: Float32Array,
  labels: string[]
): { animal: number; vehicle: number; document: number } {
  let animal = 0
  let vehicle = 0
  let document = 0
  const n = Math.min(probs.length, labels.length)
  for (let i = 0; i < n; i++) {
    const cat = categoryForImagenetIndex(i, labels[i])
    if (cat === 'animal') animal += probs[i]
    if (cat === 'vehicle') vehicle += probs[i]
    if (cat === 'document') document += probs[i]
  }
  return { animal, vehicle, document }
}

export function fuseClipAndImagenet(
  clipNine: NineProbabilities,
  imagenetNine: NineProbabilities,
  clipWeight: number
): NineProbabilities {
  const w = clipWeight
  const iw = 1 - w
  const keys = Object.keys(EMPTY_NINE) as ImageContentCategory[]
  const out = { ...EMPTY_NINE }
  for (const k of keys) {
    out[k] = w * clipNine[k] + iw * imagenetNine[k]
  }
  const sum = keys.reduce((s, k) => s + out[k], 0)
  if (sum > 1e-12) {
    for (const k of keys) out[k] /= sum
  }
  return out
}

/**
 * CLIP 概率扁平或 Top1/Top2 差距过小时提高 ImageNet 权重，减少零样本误杀。
 */
export function fuseClipAndImagenetAdaptive(
  clipNine: NineProbabilities,
  imagenetNine: NineProbabilities
): NineProbabilities {
  const keys = Object.keys(EMPTY_NINE) as ImageContentCategory[]
  const vals = keys.map(k => clipNine[k])
  const sorted = [...vals].sort((a, b) => b - a)
  const top = sorted[0]
  const second = sorted[1]
  const margin = top - second

  let clipWeight = 0.72
  if (top < 0.28 || margin < 0.06) {
    clipWeight = 0.42
  } else if (top < 0.38 || margin < 0.1) {
    clipWeight = 0.56
  } else if (top < 0.48 || margin < 0.14) {
    clipWeight = 0.64
  }

  return fuseClipAndImagenet(clipNine, imagenetNine, clipWeight)
}

/**
 * 根据 Top-K ImageNet 预测微调「人物 vs 动物」：肖像常被大量生物类概率淹没，但若 Top-K 同时出现服饰/装备类标签，则向 person 挪移一部分 animal。
 */
export function rebalancePersonAnimalFromTopPredictions(
  probs: Float32Array,
  labels: string[],
  nine: NineProbabilities,
  topM = 15
): NineProbabilities {
  const n = Math.min(probs.length, labels.length)
  const ranked = Array.from({ length: n }, (_, i) => ({ i, p: probs[i] }))
    .sort((a, b) => b.p - a.p)
    .slice(0, topM)

  let organismMass = 0
  let personCueMass = 0
  for (const { i, p } of ranked) {
    if (i <= IMAGENET_ORGANISM_MAX_INDEX) organismMass += p
    else if (PERSON_IMAGENET_CUE.test(labels[i])) personCueMass += p
  }

  const out = { ...nine }
  const keys = Object.keys(EMPTY_NINE) as ImageContentCategory[]

  const renorm = (): void => {
    const sum = keys.reduce((s, k) => s + out[k], 0)
    if (sum > 1e-12) {
      for (const k of keys) out[k] /= sum
    }
  }

  if (
    out.animal > out.person &&
    personCueMass >= 0.042 &&
    organismMass >= 0.08 &&
    personCueMass >= organismMass * 0.14
  ) {
    const shift = Math.min(
      (out.animal - out.person) * 0.42,
      personCueMass * 0.55,
      organismMass * 0.28,
      0.2
    )
    if (shift > 1e-6) {
      out.animal -= shift
      out.person += shift
      renorm()
    }
  }

  if (
    out.person > out.animal &&
    organismMass >= 0.22 &&
    organismMass >= personCueMass * 2.8 &&
    out.person - out.animal < 0.35
  ) {
    const shift = Math.min((out.person - out.animal) * 0.38, organismMass * 0.22, 0.16)
    if (shift > 1e-6) {
      out.person -= shift
      out.animal += shift
      renorm()
    }
  }

  return out
}

/**
 * CLIP 在人物/动物上意见明确时，微调融合结果（CLIP 对语义区分更强）。
 */
export function disambiguatePersonAnimalWithClip(
  merged: NineProbabilities,
  clipNine: NineProbabilities
): NineProbabilities {
  const cp = clipNine.person
  const ca = clipNine.animal
  const out = { ...merged }
  const keys = Object.keys(EMPTY_NINE) as ImageContentCategory[]

  const renorm = (): void => {
    const sum = keys.reduce((s, k) => s + out[k], 0)
    if (sum > 1e-12) {
      for (const k of keys) out[k] /= sum
    }
  }

  const clipSaysPerson = cp >= ca + 0.045 && cp >= 0.13
  const clipSaysAnimal = ca >= cp + 0.045 && ca >= 0.13

  if (clipSaysPerson && out.animal > out.person && out.animal - out.person < 0.3) {
    const shift = Math.min(out.animal * 0.24, (cp - ca) * 0.42, 0.17)
    if (shift > 1e-6) {
      out.animal -= shift
      out.person += shift
      renorm()
    }
  } else if (clipSaysAnimal && out.person > out.animal && out.person - out.animal < 0.3) {
    const shift = Math.min(out.person * 0.24, (ca - cp) * 0.42, 0.17)
    if (shift > 1e-6) {
      out.person -= shift
      out.animal += shift
      renorm()
    }
  }

  return out
}

/**
 * 当仅有 ImageNet 时，对 animal / vehicle / document 三个槽位做加权融合（计划中的 0.7/0.3）
 */
export function fuseImagenetWithObjectAux(
  baseNine: NineProbabilities,
  aux: { animal: number; vehicle: number; document: number },
  alpha: number
): NineProbabilities {
  const out: NineProbabilities = { ...baseNine }
  const a = alpha
  const ia = 1 - a
  out.animal = a * baseNine.animal + ia * aux.animal
  out.vehicle = a * baseNine.vehicle + ia * aux.vehicle
  out.document = a * baseNine.document + ia * aux.document
  const keys = Object.keys(EMPTY_NINE) as ImageContentCategory[]
  const sum = keys.reduce((s, k) => s + out[k], 0)
  if (sum > 1e-12) {
    for (const k of keys) out[k] /= sum
  }
  return out
}

export function nineProbabilitiesToTopPredictions(
  nine: NineProbabilities,
  maxItems = 3,
  minProb = 0.05,
  margin = 0.02
): Array<{ category: ImageContentCategory; confidence: number }> {
  const entries = (Object.keys(nine) as ImageContentCategory[])
    .map(k => ({ category: k, confidence: nine[k] }))
    .sort((a, b) => b.confidence - a.confidence)

  const top = entries[0]
  const second = entries[1]
  const filtered = entries.filter((e, i) => {
    if (i === 0) return true
    if (e.confidence < minProb) return false
    if (top.confidence - e.confidence < margin && i <= 2) return true
    return i < maxItems && e.confidence >= minProb
  })
  return filtered.slice(0, maxItems).map(e => ({
    category: e.category,
    confidence: Math.min(1, Math.max(0, e.confidence))
  }))
}

export function argmaxNine(nine: NineProbabilities): { category: ImageContentCategory; confidence: number } {
  let best: ImageContentCategory = 'other'
  let max = -1
  for (const k of Object.keys(nine) as ImageContentCategory[]) {
    if (nine[k] > max) {
      max = nine[k]
      best = k
    }
  }
  return { category: best, confidence: Math.min(1, Math.max(0, max)) }
}
