/**
 * 图片描述编辑器组件
 */

import React, { useState, useEffect } from 'react'
import './InfoPanel.css'

export interface DescriptionEditorProps {
  description: string
  onSave: (description: string) => void
  maxLength?: number
}

const DescriptionEditor: React.FC<DescriptionEditorProps> = ({
  description,
  onSave,
  maxLength = 200
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

  if (!isEditing) {
    return (
      <div className="info-section">
        <h3 className="info-section-title">图片描述</h3>
        <div className="info-section-content">
          {description ? (
            <div className="description-display">{description}</div>
          ) : (
            <div className="info-empty">暂无描述</div>
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

