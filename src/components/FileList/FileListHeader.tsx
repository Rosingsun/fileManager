import React from 'react'
import { Button, Select, Space, Switch } from 'antd'
import {
  LeftOutlined,
  FilterOutlined,
  ClearOutlined
} from '@ant-design/icons'
import { FILE_CATEGORIES } from '../../stores'
import type { FileInfo } from '../../types'
import { IMAGE_CATEGORY_LABELS, IMAGE_CATEGORY_ORDER } from '../../types'

interface FileListHeaderProps {
  currentPath: string
  historyList: Array<{ path: string; name: string }>
  selectedCategory: string
  selectedSubExtensions: string[]
  selectedImageCategory: string
  selectedQuality: string
  imageClassificationResults: Map<string, { category: string; confidence: number }>
  filteredFileList: FileInfo[]
  viewMode: 'list' | 'grid'
  currentPage: number
  pageSize: number
  total: number
  onGoBack: () => void
  onCategoryChange: (value: string) => void
  onSubExtensionChange: (value: string[]) => void
  onResetFilter: () => void
  onImageCategoryChange: (value: string) => void
  onQualityChange: (value: string) => void
  onViewModeChange: (mode: 'list' | 'grid') => void
  onPageChange: (page: number, pageSize: number) => void
}

export const FileListHeader: React.FC<FileListHeaderProps> = ({
  currentPath,
  historyList,
  selectedCategory,
  selectedSubExtensions,
  selectedImageCategory,
  selectedQuality,
  imageClassificationResults,
  filteredFileList,
  viewMode,
  currentPage,
  pageSize,
  total,
  onGoBack,
  onCategoryChange,
  onSubExtensionChange,
  onResetFilter,
  onImageCategoryChange,
  onQualityChange,
  onViewModeChange,
  onPageChange
}) => {
  const currentCategoryInfo = FILE_CATEGORIES.find(c => c.key === selectedCategory)
  const subExtensions = currentCategoryInfo?.extensions || []

  const showImageFilter = imageClassificationResults.size > 0

  return (
    <div className="file-filter-bar">
      <div className="file-filter-bar__left">
        <Button
          type="default"
          size="small"
          icon={<LeftOutlined />}
          onClick={onGoBack}
          disabled={!currentPath || currentPath === '/'}
          title="返回上级目录"
        >
          返回
        </Button>
        <span className="file-filter-bar__path" title={currentPath}>
          当前路径: {currentPath}
        </span>
        <div className="filter-chip">
          <FilterOutlined style={{ color: 'var(--app-text-secondary)' }} />
          <span className="filter-chip__label">类型</span>
          <Select
            value={selectedCategory}
            onChange={onCategoryChange}
            style={{ width: 100 }}
            size="small"
            dropdownMatchSelectWidth={false}
          >
            {FILE_CATEGORIES.map(cat => (
              <Select.Option key={cat.key} value={cat.key}>
                {cat.label}
              </Select.Option>
            ))}
          </Select>
          {subExtensions.length > 0 && (
            <>
              <span style={{ color: '#999' }}>/</span>
              <Select
                mode="multiple"
                value={selectedSubExtensions}
                onChange={onSubExtensionChange}
                placeholder="全部"
                style={{ width: 180 }}
                size="small"
                allowClear
                dropdownMatchSelectWidth={false}
              >
                {subExtensions.map(ext => (
                  <Select.Option key={ext} value={ext}>
                    {ext.toUpperCase()}
                  </Select.Option>
                ))}
              </Select>
            </>
          )}
          {(selectedCategory !== 'all' || selectedSubExtensions.length > 0) && (
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              onClick={onResetFilter}
              title="清除筛选"
            />
          )}
        </div>
        {selectedCategory !== 'all' && (
          <span className="file-filter-bar__meta">
            ({filteredFileList.length} 项)
          </span>
        )}
        {showImageFilter && (
          <div className="filter-chip is-emphasis">
            <span className="filter-chip__label">内容分类</span>
            <Select
              value={selectedImageCategory}
              onChange={onImageCategoryChange}
              style={{ width: 100 }}
              size="small"
              dropdownMatchSelectWidth={false}
            >
              <Select.Option value="all">全部</Select.Option>
              {IMAGE_CATEGORY_ORDER.map((key) => (
                <Select.Option key={key} value={key}>
                  {IMAGE_CATEGORY_LABELS[key]}
                </Select.Option>
              ))}
            </Select>
            {selectedImageCategory !== 'all' && (
              <Button
                type="text"
                size="small"
                icon={<ClearOutlined />}
                onClick={() => onImageCategoryChange('all')}
                title="清除分类筛选"
              />
            )}
          </div>
        )}
        {showImageFilter && (
          <div className="filter-chip is-emphasis">
            <span className="filter-chip__label">照片质量</span>
            <Select
              value={selectedQuality}
              onChange={onQualityChange}
              style={{ width: 100 }}
              size="small"
              dropdownMatchSelectWidth={false}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="high">高质量</Select.Option>
              <Select.Option value="medium">中等质量</Select.Option>
              <Select.Option value="low">低质量</Select.Option>
            </Select>
            {selectedQuality !== 'all' && (
              <Button
                type="text"
                size="small"
                icon={<ClearOutlined />}
                onClick={() => onQualityChange('all')}
                title="清除质量筛选"
              />
            )}
          </div>
        )}
      </div>
      <div className="file-filter-bar__right">
        {total > 0 && (
          <span className="file-filter-bar__meta">
            第 {currentPage} 页 / 共 {Math.ceil(total / pageSize)} 页
          </span>
        )}
        <Switch
          checkedChildren="网格"
          unCheckedChildren="列表"
          checked={viewMode === 'grid'}
          onChange={(checked: boolean) => onViewModeChange(checked ? 'grid' : 'list')}
          title={viewMode === 'list' ? '切换到网格视图' : '切换到列表视图'}
        />
      </div>
    </div>
  )
}
