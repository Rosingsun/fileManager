/**
 * 标签管理组件
 */

import React, { useState, useRef, useEffect } from 'react'
import './InfoPanel.css'

export interface TagManagerProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  suggestions?: string[]
}

const TagManager: React.FC<TagManagerProps> = ({
  tags,
  onTagsChange,
  suggestions = []
}) => {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSuggestions = suggestions.filter(
    suggestion =>
      !tags.includes(suggestion) &&
      suggestion.toLowerCase().includes(inputValue.toLowerCase())
  )

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onTagsChange([...tags, trimmedTag])
      setInputValue('')
      setShowSuggestions(false)
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      handleAddTag(inputValue)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  useEffect(() => {
    setShowSuggestions(inputValue.length > 0 && filteredSuggestions.length > 0)
  }, [inputValue, filteredSuggestions.length])

  return (
    <div className="info-section">
      <h3 className="info-section-title">标签</h3>
      <div className="info-section-content">
        <div className="tag-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="tag-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (filteredSuggestions.length > 0) {
                setShowSuggestions(true)
              }
            }}
            placeholder="输入标签后按回车添加"
          />
          {showSuggestions && (
            <div className="tag-suggestions">
              {filteredSuggestions.slice(0, 5).map((suggestion, index) => (
                <div
                  key={index}
                  className="tag-suggestion-item"
                  onClick={() => handleAddTag(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="tag-list">
          {tags.length === 0 ? (
            <div className="info-empty">暂无标签</div>
          ) : (
            tags.map((tag, index) => (
              <span key={index} className="tag-item">
                {tag}
                <button
                  className="tag-remove"
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={`删除标签 ${tag}`}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default TagManager

