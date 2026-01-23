import React, { useState, useRef } from 'react'
import { Card, List, Button, Space, Typography, Progress, Checkbox, Modal, message, Statistic, Row, Col } from 'antd'
import { DeleteOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons'
import type { SimilarityScanResult, SimilarityScanConfig } from '../../types'
import { formatFileSize, formatDateTime } from '../../utils/fileUtils'
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
  const [previewImage, setPreviewImage] = useState<string | null>(null)
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

  // 加载所有图片的缩略图
  const loadAllThumbnails = React.useCallback(async () => {
    if (!window.electronAPI) return

    const allImages: string[] = []
    result.groups.forEach(group => {
      group.images.forEach(img => {
        allImages.push(img.filePath)
      })
    })

    // 批量加载缩略图
    for (const filePath of allImages) {
      // 检查是否已经在加载
      if (loadingRef.current.has(filePath)) continue
      
      // 检查是否已加载（使用函数式更新来获取最新状态）
      setImageThumbnails(prev => {
        if (prev.has(filePath)) {
          return prev
        }
        return prev
      })
      
      loadingRef.current.add(filePath)
      setLoadingThumbnails(prev => new Set(prev).add(filePath))
      
      try {
        const thumbnail = await window.electronAPI!.getImageThumbnail(filePath, 200, 80)
        if (thumbnail) {
          setImageThumbnails(prev => {
            // 再次检查，避免重复设置
            if (prev.has(filePath)) return prev
            return new Map(prev).set(filePath, thumbnail)
          })
        }
      } catch (error) {
        console.error('加载缩略图失败:', filePath, error)
      } finally {
        loadingRef.current.delete(filePath)
        setLoadingThumbnails(prev => {
          const next = new Set(prev)
          next.delete(filePath)
          return next
        })
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

  const handlePreviewImage = async (imagePath: string) => {
    if (!window.electronAPI) return

    try {
      // 使用 getImageBase64 API 获取图片的 base64 数据
      const base64 = await window.electronAPI.getImageBase64(imagePath)
      if (base64) {
        setPreviewImage(base64)
      } else {
        message.error('预览图片失败：无法加载图片数据')
      }
    } catch (error) {
      console.error('预览图片失败:', error)
      message.error('预览图片失败')
    }
  }

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
        <Card>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="扫描照片数" value={result.totalImages} />
            </Col>
            <Col span={6}>
              <Statistic title="相似组数" value={result.totalGroups} />
            </Col>
            <Col span={6}>
              <Statistic title="可释放空间" value={formatFileSize(calculateSpaceToSave())} />
            </Col>
            <Col span={6}>
              <Statistic title="扫描耗时" value={`${(result.scanTime / 1000).toFixed(1)}秒`} />
            </Col>
          </Row>
        </Card>

        {/* 批量操作 */}
        <Card>
          <Space>
            <Button icon={<CheckCircleOutlined />} onClick={handleMarkAllBest}>
              标记所有最佳照片
            </Button>
            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={handleDeleteSelected}
              disabled={selectedGroups.size === 0}
            >
              删除选中组的非保留照片 ({selectedGroups.size} 组)
            </Button>
            <Button icon={<ReloadOutlined />} onClick={onReset}>
              重新扫描
            </Button>
          </Space>
        </Card>

        {/* 分组列表 */}
        <List
          dataSource={result.groups}
          renderItem={(group) => (
            <List.Item>
              <Card
                className={`similarity-group ${selectedGroups.has(group.id) ? 'selected' : ''}`}
                title={
                  <Space>
                    <Checkbox
                      checked={selectedGroups.has(group.id)}
                      onChange={() => handleGroupToggle(group.id)}
                    />
                    <Text strong>{group.id}</Text>
                    <Text type="secondary">
                      ({group.images.length} 张照片，相似度: {group.similarity}%)
                    </Text>
                  </Space>
                }
                extra={
                  <Progress
                    type="circle"
                    percent={group.similarity}
                    size={40}
                    format={() => `${group.similarity}%`}
                  />
                }
                style={{ width: '100%' }}
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
                            <Text type="success" style={{ fontSize: 12, marginLeft: 8 }}>
                              推荐保留
                            </Text>
                          )}
                        </div>
                        <div
                          className="image-thumbnail"
                          onClick={() => handlePreviewImage(img.filePath)}
                        >
                          {getThumbnail(img.filePath) ? (
                            <img
                              src={getThumbnail(img.filePath)!}
                              alt={img.filePath}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text>加载失败</text></svg>'
                              }}
                            />
                          ) : (
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              height: '100%',
                              background: '#f0f0f0',
                              color: '#999'
                            }}>
                              {loadingThumbnails.has(img.filePath) ? '加载中...' : '加载失败'}
                            </div>
                          )}
                        </div>
                        <div className="image-info">
                          <Text strong style={{ display: 'block' }} title={img.filePath}>
                            {img.filePath.split(/[/\\]/).pop()}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block', wordBreak: 'break-all' }} title={img.filePath}>
                            {img.filePath}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {img.width && img.height ? `${img.width}×${img.height}` : '未知尺寸'} | {formatFileSize(img.size)}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                            {formatDateTime(img.modifiedTime)}
                          </Text>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </List.Item>
          )}
        />
      </Space>

      {/* 图片预览模态框 */}
      <Modal
        open={!!previewImage}
        onCancel={() => setPreviewImage(null)}
        footer={null}
        width={900}
        centered
        styles={{ body: { padding: 0 } }}
      >
        {previewImage && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', background: '#f0f0f0' }}>
            <img 
              src={previewImage} 
              alt="预览" 
              style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text>加载失败</text></svg>'
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ScanResults

