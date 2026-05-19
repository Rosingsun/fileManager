import type { PhotoFocusPointsResult } from '../types'

/**
 * 读取本地图片的对焦点（Apple 相册等元数据）。
 * 当前无 Electron 实现时返回空列表，查看器可正常打开。
 */
export async function getPhotoFocusPoints(filePath: string): Promise<PhotoFocusPointsResult> {
  const api = window.electronAPI as { getPhotoFocusPoints?: (path: string) => Promise<PhotoFocusPointsResult> } | undefined
  if (typeof api?.getPhotoFocusPoints === 'function') {
    try {
      const res = await api.getPhotoFocusPoints(filePath)
      if (res && Array.isArray(res.points)) return res
    } catch {
      /* 忽略解析失败 */
    }
  }
  void filePath
  return { points: [] }
}
