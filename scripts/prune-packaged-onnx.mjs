/**
 * electron-builder afterPack：仅保留当前平台/架构的 onnxruntime 原生二进制。
 */
import { existsSync } from 'fs'
import { readdir, rm } from 'fs/promises'
import { join } from 'path'

/** @param {import('electron-builder').AfterPackContext} context */
export default async function prunePackagedOnnx(context) {
  const { appOutDir, electronPlatformName, arch } = context
  const base = join(
    appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'onnxruntime-node',
    'bin',
    'napi-v6'
  )
  if (!existsSync(base)) return

  const keepArch = arch === 'arm64' ? 'arm64' : 'x64'
  const keepPlatform = electronPlatformName

  for (const platform of await readdir(base, { withFileTypes: true })) {
    if (!platform.isDirectory()) continue
    const platformPath = join(base, platform.name)
    if (platform.name !== keepPlatform) {
      await rm(platformPath, { recursive: true, force: true })
      console.log(`[prune-onnx] 已移除平台: ${platform.name}`)
      continue
    }
    for (const sub of await readdir(platformPath, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue
      if (sub.name !== keepArch) {
        await rm(join(platformPath, sub.name), { recursive: true, force: true })
        console.log(`[prune-onnx] 已移除架构: ${platform.name}/${sub.name}`)
      }
    }
  }
}
