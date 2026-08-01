import { existsSync } from 'fs'
import { join } from 'path'

let cachedRoot: string | null = null

/**
 * 解析含 models/imagenet1000.json 的项目根目录（dev / 打包后 cwd 可能不一致）
 */
export function resolveProjectRoot(): string {
  if (cachedRoot && existsSync(join(cachedRoot, 'models', 'imagenet1000.json'))) {
    return cachedRoot
  }

  const candidates: string[] = []

  if (typeof __dirname !== 'undefined') {
    candidates.push(join(__dirname, '..', '..'))
    candidates.push(join(__dirname, '..', '..', '..'))
  }
  candidates.push(process.cwd())

  for (const root of candidates) {
    if (existsSync(join(root, 'models', 'imagenet1000.json'))) {
      cachedRoot = root
      return root
    }
  }

  cachedRoot = process.cwd()
  return cachedRoot
}
