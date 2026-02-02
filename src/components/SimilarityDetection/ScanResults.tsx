import React, { useState, useRef } from 'react'
import { Card, Button, Space, Typography, Progress, Checkbox, Modal, message, Statistic, Row, Col } from 'antd'
import { DeleteOutlined, ReloadOutlined, CheckCircleOutlined, PictureOutlined } from '@ant-design/icons'
import type { SimilarityScanResult, SimilarityScanConfig } from '../../types'
import { formatFileSize, formatDateTime } from '../../utils/fileUtils'
import ImagePreview, { type ImageSource } from '../ImagePreview/ImagePreview'
import { imageLoader } from '../../utils/imageLoader'
import './ScanResults.css'

const { Text } = Typography

interface ScanResultsProps {
  result: SimilarityScanResult
  config: SimilarityScanConfig
  onReset: () => void
}

const ScanResults: React.FC<ScanResultsProps> = ({ result, onReset }) => {
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [groupSelections, setGroupSelections] = useState<Map<string, Set<string>>>(new Map())
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewImages, setPreviewImages] = useState<ImageSource[]>([])
  const [previewCurrentIndex, setPreviewCurrentIndex] = useState(0)
  const [imageThumbnails, setImageThumbnails] = useState<Map<string, string>>(new Map())
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<string>>(new Set())
  const loadingRef = useRef<Set<string>>(new Set())

  // 初始化：所有组都选中，每组默认保留推荐的照片
  React.useEffect(() => {
    const newSelections = new Map<string, Set<string>>()
    result.groups.forEach(group => {
      const keepSet = new Set<string>()
      if (group.recommendedKeep) {
        keepSet.add(group.recommendedKeep)
      } else if (group.images.length > 0) {
        keepSet.add(group.images[0].filePath)
      }
      newSelections.set(group.id, keepSet)
    })
    setGroupSelections(newSelections)
    setSelectedGroups(new Set(result.groups.map(g => g.id)))
    
    // 清空之前的缩略图缓存
    setImageThumbnails(new Map())
    loadingRef.current.clear()
    setLoadingThumbnails(new Set())
    
    // 加载所有图片的缩略图
    loadAllThumbnails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  // 加载所有图片的缩略图（优化版本）
  const loadAllThumbnails = React.useCallback(async () => {
    const allImages: string[] = []
    result.groups.forEach(group => {
      group.images.forEach(img => {
        allImages.push(img.filePath)
      })
    })

    console.log(`[ScanResults] 开始批量加载 ${allImages.length} 张图片的缩略图`)
    
    // 使用优化的图片加载器批量预加载
    try {
      await imageLoader.preloadBatch(allImages, 'thumbnail', 4)
      
      // 预加载完成后，更新状态
      const thumbnails = new Map<string, string>()
      const loadPromises = allImages.map(async (filePath) => {
        try {
          const result = await imageLoader.loadThumbnail(filePath, 300, 85, {
            useCache: true,
            timeout: 10000,
            retryCount: 1
          })
          
          if (result.data) {
            thumbnails.set(filePath, result.data)
          }
        } catch (error) {
          console.error('加载缩略图失败:', filePath, error)
        }
      })
      
      await Promise.allSettled(loadPromises)
      
      setImageThumbnails(thumbnails)
      console.log(`[ScanResults] 缩略图加载完成，成功: ${thumbnails.size}/${allImages.length}`)
      
    } catch (error) {
      console.error('[ScanResults] 批量加载缩略图失败:', error)
      
      // 降级到单个加载
      for (const filePath of allImages) {
        if (loadingRef.current.has(filePath)) continue
        
        loadingRef.current.add(filePath)
        setLoadingThumbnails(prev => new Set(prev).add(filePath))
        
        try {
          const result = await imageLoader.loadThumbnail(filePath, 300, 85)
          if (result.data) {
            setImageThumbnails(prev => {
              if (!prev.has(filePath)) {
                return new Map(prev).set(filePath, result.data)
              }
              return prev
            })
          }
        } catch (error) {
          console.error('降级加载缩略图失败:', filePath, error)
        } finally {
          loadingRef.current.delete(filePath)
          setLoadingThumbnails(prev => {
            const next = new Set(prev)
            next.delete(filePath)
            return next
          })
        }
      }
    }
  }, [result.groups])

  // 获取图片缩略图
  const getThumbnail = (filePath: string): string | null => {
    return imageThumbnails.get(filePath) || null
  }

  const handleGroupToggle = (groupId: string) => {
    const newSelected = new Set(selectedGroups)
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId)
    } else {
      newSelected.add(groupId)
    }
    setSelectedGroups(newSelected)
  }

  const handleImageToggle = (groupId: string, imagePath: string) => {
    const newSelections = new Map(groupSelections)
    const groupSelection = new Set(newSelections.get(groupId) || [])
    
    if (groupSelection.has(imagePath)) {
      // 至少保留一张
      if (groupSelection.size > 1) {
        groupSelection.delete(imagePath)
      } else {
        message.warning('每组至少需要保留一张照片')
        return
      }
    } else {
      groupSelection.add(imagePath)
    }
    
    newSelections.set(groupId, groupSelection)
    setGroupSelections(newSelections)
  }

  const handleMarkAllBest = () => {
    const newSelections = new Map<string, Set<string>>()
    result.groups.forEach(group => {
      const keepSet = new Set<string>()
      if (group.recommendedKeep) {
        keepSet.add(group.recommendedKeep)
      } else if (group.images.length > 0) {
        keepSet.add(group.images[0].filePath)
      }
      newSelections.set(group.id, keepSet)
    })
    setGroupSelections(newSelections)
    message.success('已标记所有推荐保留的照片')
  }

  const handleDeleteSelected = async () => {
    const groupsToProcess = result.groups.filter(g => selectedGroups.has(g.id))
    let totalToDelete = 0
    const filesToDelete: string[] = []

    groupsToProcess.forEach(group => {
      const keepSet = groupSelections.get(group.id) || new Set()
      group.images.forEach(img => {
        if (!keepSet.has(img.filePath)) {
          filesToDelete.push(img.filePath)
          totalToDelete++
        }
      })
    })

    if (totalToDelete === 0) {
      message.warning('没有可删除的照片')
      return
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 ${totalToDelete} 张照片吗？此操作不可撤销！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        if (!window.electronAPI) {
          message.error('Electron API 不可用')
          return
        }

        let successCount = 0
        let failCount = 0

        for (const filePath of filesToDelete) {
          try {
            const success = await window.electronAPI.deleteFile(filePath)
            if (success) {
              successCount++
            } else {
              failCount++
            }
          } catch (error) {
            failCount++
            console.error('删除文件失败:', filePath, error)
          }
        }

        if (failCount === 0) {
          message.success(`成功删除 ${successCount} 张照片`)
        } else {
          message.warning(`删除完成：成功 ${successCount} 张，失败 ${failCount} 张`)
        }

        // 重新扫描或重置
        onReset()
      }
    })
  }

  // 加载图片的 base64 数据（优化版本）
  const loadImageBase64 = React.useCallback(async (filePath: string): Promise<string | null> => {
    try {
      // 使用优化的图片加载器进行智能加载
      const result = await imageLoader.loadSmart(filePath, {
        useCache: true,
        timeout: 15000,
        retryCount: 1,
        fallbackSize: 400,
        fallbackQuality: 80
      })
      
      if (result.data) {
        return result.data
      }
      
      return null
    } catch (error) {
      console.error('加载图片 base64 失败:', filePath, error)
      return null
    }
  }, [])

  // 预览图片（支持组内导航）
  const handlePreviewImage = React.useCallback(async (imagePath: string, groupId?: string) => {
    if (!window.electronAPI) return

    try {
      // 找到图片所在的组
      let targetGroup = result.groups.find(g => 
        g.images.some(img => img.filePath === imagePath)
      )

      // 如果提供了 groupId，优先使用
      if (groupId) {
        targetGroup = result.groups.find(g => g.id === groupId)
      }

      if (!targetGroup) {
        message.error('未找到图片所在的组')
        return
      }

      // 加载该组所有图片的 base64 数据
      const imageSources: ImageSource[] = []
      let currentIndex = 0

      for (let i = 0; i < targetGroup.images.length; i++) {
        const img = targetGroup.images[i]
        const base64 = await loadImageBase64(img.filePath)
        
        if (base64) {
          const fileName = img.filePath.split(/[/\\]/).pop() || '未知文件'
          imageSources.push({
            src: base64,
            title: fileName,
            description: `${formatFileSize(img.size)} | ${img.width && img.height ? `${img.width}×${img.height}` : '未知尺寸'}`
          })

          // 记录当前点击的图片索引
          if (img.filePath === imagePath) {
            currentIndex = imageSources.length - 1
          }
        }
      }

      if (imageSources.length === 0) {
        message.error('预览图片失败：无法加载图片数据')
        return
      }

      setPreviewImages(imageSources)
      setPreviewCurrentIndex(currentIndex)
      setPreviewVisible(true)
    } catch (error) {
      console.error('预览图片失败:', error)
      message.error('预览图片失败')
    }
  }, [result.groups, loadImageBase64])

  const calculateSpaceToSave = (): number => {
    let totalSize = 0
    result.groups.forEach(group => {
      if (!selectedGroups.has(group.id)) return
      const keepSet = groupSelections.get(group.id) || new Set()
      group.images.forEach(img => {
        if (!keepSet.has(img.filePath)) {
          totalSize += img.size
        }
      })
    })
    return totalSize
  }

  return (
    <div className="scan-results">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 统计信息 */}
        <Card className="stat-card" variant="borderless">
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={12} md={6}>
              <div className="stat-item">
                <Statistic 
                  title={<span className="stat-title">扫描照片数</span>} 
                  value={result.totalImages} 
                  valueStyle={{ color: '#1890ff', fontSize: '24px', fontWeight: '600' }}
                />
              </div>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <div className="stat-item">
                <Statistic 
                  title={<span className="stat-title">相似组数</span>} 
                  value={result.totalGroups} 
                  valueStyle={{ color: '#52c41a', fontSize: '24px', fontWeight: '600' }}
                />
              </div>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <div className="stat-item">
                <Statistic 
                  title={<span className="stat-title">可释放空间</span>} 
                  value={formatFileSize(calculateSpaceToSave())} 
                  valueStyle={{ color: '#faad14', fontSize: '24px', fontWeight: '600' }}
                />
              </div>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <div className="stat-item">
                <Statistic 
                  title={<span className="stat-title">扫描耗时</span>} 
                  value={`${(result.scanTime / 1000).toFixed(1)}秒`} 
                  valueStyle={{ color: '#722ed1', fontSize: '24px', fontWeight: '600' }}
                />
              </div>
            </Col>
          </Row>
        </Card>

        {/* 批量操作 */}
        <Card className="batch-actions-card" variant="borderless">
          <div className="batch-actions">
            <Button 
              icon={<CheckCircleOutlined />} 
              onClick={handleMarkAllBest}
              className="batch-btn"
              size="large"
            >
              标记所有最佳照片
            </Button>
            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={handleDeleteSelected}
              disabled={selectedGroups.size === 0}
              className="batch-btn delete-btn"
              size="large"
            >
              删除选中组的非保留照片 ({selectedGroups.size} 组)
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={onReset}
              className="batch-btn reset-btn"
              size="large"
            >
              重新扫描
            </Button>
          </div>
        </Card>

        {/* 分组列表 */}
        <div className="groups-list">
          {result.groups.map((group) => (
            <div key={group.id} className="group-list-item">
              <Card
                className={`similarity-group ${selectedGroups.has(group.id) ? 'selected' : ''}`}
                variant="borderless"
                title={
                  <div className="group-card-header">
                    <div className="group-card-title">
                      <Checkbox
                        checked={selectedGroups.has(group.id)}
                        onChange={() => handleGroupToggle(group.id)}
                        className="group-checkbox"
                      />
                      <Text strong className="group-id">{group.id}</Text>
                      <Text type="secondary" className="group-info">
                        ({group.images.length} 张照片，相似度: {group.similarity}%)
                      </Text>
                    </div>
                    <div className="group-similarity-indicator">
                      <Progress
                        type="circle"
                        percent={group.similarity}
                        size={40}
                        format={() => `${group.similarity}%`}
                        strokeColor={{
                          '0%': '#ff4d4f',
                          '50%': '#faad14',
                          '100%': '#52c41a'
                        }}
                      />
                    </div>
                  </div>
                }
              >
                <div className="group-images">
                  {group.images.map((img) => {
                    const isKept = (groupSelections.get(group.id) || new Set()).has(img.filePath)
                    const isRecommended = img.filePath === group.recommendedKeep

                    return (
                      <div
                        key={img.filePath}
                        className={`image-item ${isKept ? 'kept' : 'to-delete'} ${isRecommended ? 'recommended' : ''}`}
                      >
                        <div className="image-checkbox">
                          <Checkbox
                            checked={isKept}
                            onChange={() => handleImageToggle(group.id, img.filePath)}
                          />
                          {isRecommended && (
                            <div className="recommended-badge">
                              <CheckCircleOutlined style={{ fontSize: 12, marginRight: 4 }} />
                              推荐保留
                            </div>
                          )}
                        </div>
                        <div
                          className="image-thumbnail"
                          onClick={() => handlePreviewImage(img.filePath, group.id)}
                          title="点击预览"
                        >
                          {getThumbnail(img.filePath) ? (
                            <img
                              src={getThumbnail(img.filePath)!}
                              alt={img.filePath}
                              className="thumbnail-image"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#999" font-size="14">加载失败</text></svg>'
                              }}
                            />
                          ) : (
                            <div className="thumbnail-placeholder">
                              {loadingThumbnails.has(img.filePath) ? (
                                <div className="loading-spinner"></div>
                              ) : (
                                <PictureOutlined style={{ fontSize: '32px', color: '#ccc' }} />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="image-info">
                          <Text strong className="file-name" title={img.filePath}>
                            {img.filePath.split(/[/\\]/).pop()}
                          </Text>
                          <div className="file-meta">
                            <Text type="secondary" className="file-size">
                              {formatFileSize(img.size)}
                            </Text>
                            <Text type="secondary" className="file-dimensions">
                              {img.width && img.height ? `${img.width}×${img.height}` : '未知尺寸'}
                            </Text>
                          </div>
                          <Text type="secondary" className="file-time">
                            {formatDateTime(img.modifiedTime)}
                          </Text>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      </Space>

      {/* 图片预览组件 */}
      <ImagePreview
        visible={previewVisible}
        images={previewImages}
        currentIndex={previewCurrentIndex}
        onClose={() => setPreviewVisible(false)}
        onIndexChange={setPreviewCurrentIndex}
        width={900}
        showToolbar={true}
        showNavigation={previewImages.length > 1}
        enableKeyboard={true}
      />
    </div>
  )
}

export default ScanResults

