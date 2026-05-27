/**
 * 将 file:// URL 转为本地路径（用于 Electron 中调用需磁盘路径的 IPC）
 * 与 ImageViewer 内 getImageBase64 的 `url.replace(/^file:\\/\\//, '')` 规则一致，避免 `new URL()` 在
 * `file://D:/...`（双斜杠）或含反斜杠时解析错误。
 */
export function getFilePathFromFileUrl(url: string | undefined | null): string | null {
  if (!url?.startsWith('file:')) return null
  let p = url.replace(/^file:\/\//i, '')
  try {
    p = decodeURIComponent(p.replace(/\+/g, ' '))
  } catch {
    // 保持原样
  }
  p = p.replace(/\\/g, '/')
  // file:///C:/path → 去掉 file:// 后为 /C:/path
  if (/^\/[A-Za-z]:\//.test(p)) {
    p = p.slice(1)
  }
  const trimmed = p.trim()
  return trimmed || null
}
