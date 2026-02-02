/**
 * 环形进度条组件
 */

import React from 'react'
import './CircularProgress.css'

export interface CircularProgressProps {
  /** 进度值，0-100 */
  progress: number
  /** 尺寸（像素） */
  size?: number
  /** 线条宽度（像素） */
  strokeWidth?: number
  /** 颜色 */
  color?: string
  /** 背景颜色 */
  backgroundColor?: string
  /** 是否显示百分比文字 */
  showText?: boolean
  /** 自定义文字 */
  text?: string
  /** 类名 */
  className?: string
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 40,
  strokeWidth = 4,
  color = '#1890ff',
  backgroundColor = '#f0f0f0',
  showText = true,
  text,
  className = ''
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  const displayText = text !== undefined ? text : showText ? `${Math.round(progress)}%` : ''

  return (
    <div className={`circular-progress ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="circular-progress-svg">
        {/* 背景圆 */}
        <circle
          className="circular-progress-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={backgroundColor}
          fill="none"
        />
        {/* 进度圆 */}
        <circle
          className="circular-progress-fg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {/* 文字 */}
      {displayText && (
        <div className="circular-progress-text" style={{ fontSize: size * 0.25 }}>
          {displayText}
        </div>
      )}
    </div>
  )
}

export default CircularProgress

