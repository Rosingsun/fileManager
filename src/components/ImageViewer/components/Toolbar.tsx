/**
 * 图片操作工具栏组件
 */

import React from 'react'
import './InfoPanel.css'

export interface ToolbarProps {
  currentIndex: number
  totalCount: number
  rotation: number
  flipHorizontal: boolean
  flipVertical: boolean
  onPrev: () => void
  onNext: () => void
  onRotate: () => void
  onFlipHorizontal: () => void
  onFlipVertical: () => void
  onReset: () => void
  onDelete?: () => void
  onDownload?: () => void
  onFavorite?: () => void
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentIndex,
  totalCount,
  rotation,
  flipHorizontal,
  flipVertical,
  onPrev,
  onNext,
  onRotate,
  onFlipHorizontal,
  onFlipVertical,
  onReset,
  onDelete,
  onDownload,
  onFavorite
}) => {
  return (
    <div className="info-section">
      <h3 className="info-section-title">操作</h3>
      <div className="info-section-content">
        {/* 导航控制 */}
        <div className="toolbar-group">
          <div className="toolbar-label">导航</div>
          <div className="toolbar-buttons">
            <button
              className="toolbar-btn"
              onClick={onPrev}
              disabled={currentIndex <= 0}
              title="上一张 (←)"
            >
              ← 上一张
            </button>
            <span className="toolbar-counter">
              {currentIndex + 1} / {totalCount}
            </span>
            <button
              className="toolbar-btn"
              onClick={onNext}
              disabled={currentIndex >= totalCount - 1}
              title="下一张 (→)"
            >
              下一张 →
            </button>
          </div>
        </div>

        {/* 变换操作 */}
        <div className="toolbar-group">
          <div className="toolbar-label">变换</div>
          <div className="toolbar-buttons">
            <button
              className="toolbar-btn"
              onClick={onRotate}
              title="旋转 (R)"
            >
              ↻ 旋转 ({rotation}°)
            </button>
            <button
              className="toolbar-btn"
              onClick={onFlipHorizontal}
              title="水平翻转"
            >
              ⇄ 水平翻转
            </button>
            <button
              className="toolbar-btn"
              onClick={onFlipVertical}
              title="垂直翻转"
            >
              ⇅ 垂直翻转
            </button>
            <button
              className="toolbar-btn"
              onClick={onReset}
              title="重置变换"
            >
              ↺ 重置
            </button>
          </div>
        </div>

        {/* 其他操作 */}
        <div className="toolbar-group">
          <div className="toolbar-label">其他</div>
          <div className="toolbar-buttons">
            {onDownload && (
              <button
                className="toolbar-btn"
                onClick={onDownload}
                title="下载原图"
              >
                ⬇ 下载
              </button>
            )}
            {onFavorite && (
              <button
                className="toolbar-btn"
                onClick={onFavorite}
                title="设为收藏"
              >
                ⭐ 收藏
              </button>
            )}
            {onDelete && (
              <button
                className="toolbar-btn toolbar-btn-danger"
                onClick={onDelete}
                title="删除图片"
              >
                🗑 删除
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Toolbar

