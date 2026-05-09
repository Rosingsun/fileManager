/**
 * EXIF信息区域组件
 */

import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useExifParser } from '../../../hooks'
import type { Image } from '../types'
import './InfoPanel.css'

export interface ExifInfoSectionProps {
  image: Image
  /** 本地绝对路径，用于主进程读取快门次数 */
  imageFilePath?: string | null
  /** 与画布一致的可解析 URL（data:/blob:/http），勿传未转换的 file:// */
  exifSourceUrl?: string | null
  /** file:// 转 blob/base64 过程中为 true，避免误判为「无 EXIF」 */
  exifSourceLoading?: boolean
}

const ExifInfoSection: React.FC<ExifInfoSectionProps> = ({
  image,
  imageFilePath,
  exifSourceUrl,
  exifSourceLoading
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [shutterLoading, setShutterLoading] = useState(() =>
    Boolean(
      typeof window !== 'undefined' &&
        window.electronAPI?.getShutterCount &&
        imageFilePath?.trim()
    )
  )
  const [shutter, setShutter] = useState<{ count: number | null } | null>(null)

  const urlForExif =
    exifSourceUrl ??
    (image.url && !image.url.startsWith('file:') ? image.url : undefined)
  const { formattedExif, isLoading } = useExifParser(image.exif, urlForExif)
  const waitingForLocalFile =
    Boolean(exifSourceLoading) && !exifSourceUrl && !image.exif
  const showLoading = isLoading || waitingForLocalFile

  useLayoutEffect(() => {
    if (imageFilePath?.trim() && window.electronAPI?.getShutterCount) {
      setShutterLoading(true)
      setShutter(null)
    }
  }, [imageFilePath])

  useEffect(() => {
    if (!imageFilePath?.trim()) {
      setShutter(null)
      setShutterLoading(false)
      return
    }
    if (!window.electronAPI?.getShutterCount) {
      setShutter({ count: null })
      setShutterLoading(false)
      return
    }
    let cancelled = false
    window.electronAPI
      .getShutterCount(imageFilePath.trim())
      .then((res) => {
        if (!cancelled) setShutter(res)
      })
      .catch(() => {
        if (!cancelled) {
          setShutter({ count: null })
        }
      })
      .finally(() => {
        if (!cancelled) setShutterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [imageFilePath])

  const mergedDisplay = useMemo(() => {
    let shutterLabel: string | null = null
    if (imageFilePath?.trim()) {
      if (shutterLoading) shutterLabel = '读取中…'
      else if (shutter?.count != null) shutterLabel = String(shutter.count)
      else shutterLabel = '未知'
    }
    if (!shutterLabel) return { ...formattedExif }

    const entries = Object.entries(formattedExif)
    const camIdx = entries.findIndex(([k]) => k === '相机')
    if (camIdx === -1) {
      return { ...formattedExif, 快门次数: shutterLabel }
    }
    const out: Record<string, string> = {}
    for (let i = 0; i <= camIdx; i++) {
      out[entries[i][0]] = entries[i][1]
    }
    out['快门次数'] = shutterLabel
    for (let i = camIdx + 1; i < entries.length; i++) {
      out[entries[i][0]] = entries[i][1]
    }
    return out
  }, [formattedExif, imageFilePath, shutter, shutterLoading])

  const hasGridContent = Object.keys(mergedDisplay).length > 0

  // 切换展开/折叠状态
  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  if (!hasGridContent) {
    return (
      <div className="info-section">
        <div className="info-section-header">
          <h3 className="info-section-title">EXIF信息</h3>
        </div>
        <div className="info-section-content">
          {showLoading || (imageFilePath?.trim() && shutterLoading) ? (
            <div className="info-loading">加载中...</div>
          ) : (
            <div className="info-empty">暂无EXIF数据</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="info-section exif-section">
      <div className="info-section-header">
        <h3 className="info-section-title">EXIF信息</h3>
        <button 
          className="section-toggle-btn" 
          onClick={toggleExpand}
          title={isExpanded ? "收起EXIF信息" : "查看EXIF信息"}
        >
          {isExpanded ? "▼" : "▶"}
        </button>
      </div>
      
      {isExpanded && (
        <div className="info-section-content">
          <div className="exif-info-grid">
            {Object.entries(mergedDisplay).map(([key, value]) => (
              <div key={key} className="exif-info-item">
                <div className="exif-info-label">{key}</div>
                <div className="exif-info-value">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ExifInfoSection
