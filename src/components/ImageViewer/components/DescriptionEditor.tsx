/**
 * 图片描述编辑器组件
 */

import React, { useState, useEffect } from 'react'
import type { ImageClassificationResult, ImageContentCategory } from '../../../types'
import './InfoPanel.css'

export interface DescriptionEditorProps {
  description: string
  onSave: (description: string) => void
  maxLength?: number
  classification?: ImageClassificationResult
}

const CATEGORY_COLORS: Record<ImageContentCategory, string> = {
  person: '#722ed1', portrait: '#eb2f96', selfie: '#fa541c',
  dog: '#fa8c16', cat: '#fadb14', bird: '#13c2c2', wild_animal: '#52c41a',
  marine_animal: '#1890ff', insect: '#95de64', pet: '#ffc53d',
  landscape: '#73d13d', mountain: '#08979c', beach: '#40a9ff', sunset: '#fa8c16',
  forest: '#389e0d', cityscape: '#1d39c4', night_scene: '#531dab',
  building: '#1890ff', landmark: '#13c2c2', interior: '#73d13d', street: '#1d39c4',
  food: '#f5222d', drink: '#69c0ff', dessert: '#ff85c0',
  vehicle: '#1890ff', aircraft: '#597ef7', ship: '#36cfc9',
  art: '#eb2f96', technology: '#2f54eb', document: '#faad14', other: '#8c8c8c'
}

const CATEGORY_LABELS: Record<ImageContentCategory, string> = {
  person: '人物', portrait: '人像', selfie: '自拍',
  dog: '狗', cat: '猫', bird: '鸟类', wild_animal: '野生动物', marine_animal: '海洋生物', insect: '昆虫', pet: '宠物',
  landscape: '风景', mountain: '山脉', beach: '海滩', sunset: '日落', forest: '森林', cityscape: '城市风光', night_scene: '夜景',
  building: '建筑', landmark: '地标', interior: '室内', street: '街道',
  food: '食物', drink: '饮品', dessert: '甜点',
  vehicle: '车辆', aircraft: '飞机', ship: '船舶',
  art: '艺术', technology: '科技', document: '文档', other: '其他'
}

const DescriptionEditor: React.FC<DescriptionEditorProps> = ({
  description,
  onSave,
  maxLength = 200,
  classification
}) => {
  const [value, setValue] = useState(description)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setValue(description)
  }, [description])

  const handleSave = () => {
    onSave(value)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setValue(description)
    setIsEditing(false)
  }

  const classificationLabel = classification
    ? `${CATEGORY_LABELS[classification.category] || classification.category}`
    : null
  const confidencePercent = classification
    ? Math.round(classification.confidence * 100)
    : 0
  const classificationColor = classification
    ? CATEGORY_COLORS[classification.category] || CATEGORY_COLORS.other
    : '#8c8c8c'

  if (!isEditing) {
    return (
      <div className="info-section">
        <h3 className="info-section-title">图片描述</h3>
        <div className="info-section-content">
          {classificationLabel && (
            <div className="classification-info">
              <span className="classification-badge" style={{ backgroundColor: classificationColor }}>
                🏷 {classificationLabel}
              </span>
              <span className="classification-confidence-text" style={{ color: classificationColor }}>
                {confidencePercent}% 置信度
              </span>
            </div>
          )}
          {description ? (
            <div className="description-display">{description}</div>
          ) : (
            <div className="info-empty">{classificationLabel ? '暂无描述' : '暂无描述'}</div>
          )}
          <button
            className="info-edit-btn"
            onClick={() => setIsEditing(true)}
          >
            编辑
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="info-section">
      <h3 className="info-section-title">图片描述</h3>
      <div className="info-section-content">
        {classificationLabel && (
          <div className="classification-info">
            <span className="classification-badge" style={{ backgroundColor: classificationColor }}>
              🏷 {classificationLabel}
            </span>
            <span className="classification-confidence-text" style={{ color: classificationColor }}>
              {confidencePercent}% 置信度
            </span>
          </div>
        )}
        <textarea
          className="description-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={maxLength}
          rows={4}
          placeholder="输入图片描述..."
        />
        <div className="description-footer">
          <span className="description-count">
            {value.length} / {maxLength}
          </span>
          <div className="description-actions">
            <button
              className="info-btn info-btn-secondary"
              onClick={handleCancel}
            >
              取消
            </button>
            <button
              className="info-btn info-btn-primary"
              onClick={handleSave}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DescriptionEditor

