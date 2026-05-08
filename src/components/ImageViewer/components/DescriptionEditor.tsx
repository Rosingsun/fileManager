/**
 * 图片描述编辑器组件
 */

import React, { useState, useEffect } from 'react'
import type { ImageClassificationResult } from '../../../types'
import { IMAGE_CATEGORY_LABELS } from '../../../types'
import { getCategoryTagColor } from '../../../utils'
import './InfoPanel.css'

export interface DescriptionEditorProps {
  description: string
  onSave: (description: string) => void
  maxLength?: number
  classification?: ImageClassificationResult
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
    ? `${IMAGE_CATEGORY_LABELS[classification.category] || classification.category}`
    : null
  const confidencePercent = classification
    ? Math.round(classification.confidence * 100)
    : 0
  const classificationColor = classification
    ? getCategoryTagColor(classification.category)
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
          <p className="description-text">{description || '暂无描述'}</p>
          <button className="edit-button" onClick={() => setIsEditing(true)}>
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
        <textarea
          className="description-textarea"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
          rows={4}
          maxLength={maxLength}
        />
        <div className="description-actions">
          <span className="char-count">{value.length}/{maxLength}</span>
          <button className="save-button" onClick={handleSave}>保存</button>
          <button className="cancel-button" onClick={handleCancel}>取消</button>
        </div>
      </div>
    </div>
  )
}

export default DescriptionEditor
