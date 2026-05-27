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
  onReset
}) => {
  return (
    <div className="info-section">
      <h3 className="info-section-title">操作</h3>
      <div className="info-section-content">
        {/* 分页控制 */}
        <div className="toolbar-group">
          <div className="toolbar-label">分页</div>
          <div className="toolbar-buttons">
            <button
              className="toolbar-btn"
              onClick={onPrev}
              disabled={currentIndex <= 0}
              title="上一张 (←)"
            >
              ←
            </button>
            <span className="toolbar-counter toolbar-counter-wide">
              {currentIndex + 1} / {totalCount}
            </span>
            <button
              className="toolbar-btn"
              onClick={onNext}
              disabled={currentIndex >= totalCount - 1}
              title="下一张 (→)"
            >
              →
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
              title={`旋转 ${rotation}° (R)`}
            >
              ↻
            </button>
            <button
              className="toolbar-btn"
              onClick={onFlipHorizontal}
              title="水平翻转"
            >
              ⇄
            </button>
            <button
              className="toolbar-btn"
              onClick={onFlipVertical}
              title="垂直翻转"
            >
              ⇅
            </button>
            <button
              className="toolbar-btn"
              onClick={onReset}
              title="重置变换"
            >
              ↺
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Toolbar

