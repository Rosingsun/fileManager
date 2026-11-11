#!/usr/bin/env node
/**
 * 统一导出规则校验：src/ 下跨层导入必须走 utils/hooks/stores/components 的 index.ts
 * 零依赖，直接由 Node 运行：node scripts/check-import-boundaries.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')
const unifiedDirs = new Set(['utils', 'hooks', 'stores', 'components'])
const sourceExt = /\.(ts|tsx)$/
const assetExt = /\.(css|scss|less|svg|png|jpe?g|webp|json|woff2?)$/i
const importPattern = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name !== 'node_modules') walk(full, out)
    } else if (sourceExt.test(full)) {
      out.push(full)
    }
  }
  return out
}

// 已知例外：动态 import 直连 store 用于打断 utils <-> stores 循环依赖
const knownExceptions = new Set(['src/utils/operationLog.ts|../stores/useAuthStore'])
const violations = []

for (const file of walk(srcDir)) {
  // 统一出口自身必须直连子模块，跳过
  if (/^(index|.*[/\\]index)\.(ts|tsx)$/.test(file)) continue

  const relFile = relative(srcDir, file).split(sep)
  const srcTop = relFile[0]
  const relPath = relative(root, file).split(sep).join('/')
  const content = readFileSync(file, 'utf8')
  let match

  while ((match = importPattern.exec(content)) !== null) {
    const spec = match[1]
    if (assetExt.test(spec)) continue

    let target
    if (spec.startsWith('@/')) target = join(srcDir, spec.slice(2))
    else if (spec.startsWith('.')) target = resolve(dirname(file), spec)
    else continue

    const rel = relative(srcDir, target).split(sep)
    const top = rel[0]
    if (!unifiedDirs.has(top)) continue
    // 指向目录本身（如 ../utils）即走 index.ts，合规
    if (rel.length < 2) continue
    // shadcn ui 组件保持原有内部引用方式
    if (top === 'components' && rel[1] === 'ui') continue
    // 同一顶层目录内的兄弟模块引用，合规
    if (srcTop === top) continue
    if (knownExceptions.has(`${relPath}|${spec}`)) continue

    const line = content.slice(0, match.index).split('\n').length
    violations.push(`${relPath}:${line}  ${spec}`)
  }
}

if (violations.length > 0) {
  console.error(`发现 ${violations.length} 处绕过统一导出的导入，请改从对应目录的 index.ts 引入：`)
  for (const item of violations) console.error(`  - ${item}`)
  process.exit(1)
}

console.log('统一导出规则校验通过：未发现跨层直连导入。')
