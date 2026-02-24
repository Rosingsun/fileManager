import React from 'react'
import { Button, Select, Space, Switch } from 'antd'
import {
  LeftOutlined,
  FilterOutlined,
  ClearOutlined
} from '@ant-design/icons'
import { FILE_CATEGORIES } from '../../stores'
import type { FileInfo } from '../../types'

interface FileListHeaderProps {
  currentPath: string
  historyList: Array<{ path: string; name: string }>
  selectedCategory: string
  selectedSubExtensions: string[]
  selectedImageCategory: string
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
  onViewModeChange: (mode: 'list' | 'grid') => void
  onPageChange: (page: number, pageSize: number) => void
}

export const FileListHeader: React.FC<FileListHeaderProps> = ({
  currentPath,
  historyList,
  selectedCategory,
  selectedSubExtensions,
  selectedImageCategory,
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
  onViewModeChange,
  onPageChange
}) => {
  const isCurrentPathInHistory = currentPath
    ? historyList.some(item => item.path === currentPath)
    : false

  const currentCategoryInfo = FILE_CATEGORIES.find(c => c.key === selectedCategory)
  const subExtensions = currentCategoryInfo?.extensions || []

  const showImageFilter = imageClassificationResults.size > 0

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <Space size="small">
        {!isCurrentPathInHistory && (
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
        )}
        {!isCurrentPathInHistory && (
          <span style={{ fontSize: '14px', color: '#666' }}>
            当前路径: {currentPath}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16, padding: '4px 8px', backgroundColor: '#f5f5f5', borderRadius: 6 }}>
          <FilterOutlined style={{ color: '#666' }} />
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
          <span style={{ fontSize: 12, color: '#999' }}>
            ({filteredFileList.length} 项)
          </span>
        )}
        {showImageFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', backgroundColor: '#f0f5ff', borderRadius: 6, marginLeft: 8 }}>
            <span style={{ fontSize: 12, color: '#1890ff' }}>内容分类:</span>
            <Select
              value={selectedImageCategory}
              onChange={onImageCategoryChange}
              style={{ width: 100 }}
              size="small"
              dropdownMatchSelectWidth={false}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="animal">动物</Select.Option>
              <Select.Option value="vehicle">车辆</Select.Option>
              <Select.Option value="person">人物</Select.Option>
              <Select.Option value="landscape">风景</Select.Option>
              <Select.Option value="architecture">建筑</Select.Option>
              <Select.Option value="food">食物</Select.Option>
              <Select.Option value="other">其他</Select.Option>
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
      </Space>
      <Space size="middle">
        <Switch
          checkedChildren="网格"
          unCheckedChildren="列表"
          checked={viewMode === 'grid'}
          onChange={(checked: boolean) => onViewModeChange(checked ? 'grid' : 'list')}
          title={viewMode === 'list' ? '切换到网格视图' : '切换到列表视图'}
        />
      </Space>
    </div>
  )
}
