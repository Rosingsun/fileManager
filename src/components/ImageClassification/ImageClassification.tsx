import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Card, Button, Progress, Statistic, Table, Tag, Space, message, Alert, Modal, Typography, Select } from 'antd'
import {
  ApiOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  UserOutlined,
  FrownOutlined,
  PictureOutlined,
  BuildOutlined,
  CoffeeOutlined,
  CarOutlined,
  AppstoreOutlined
} from '@ant-design/icons'
import type { ImageContentCategory, ImageClassificationResult, ImageClassificationProgress } from '../../types'
import { useFileStore } from '../../stores/fileStore'
import ImageViewer from '../ImageViewer/ImageViewer'
import type { Image } from '../ImageViewer/types'
import { CategoryTag, PageSection, StatCard } from '../UnifiedUI'
import { getCategoryTagColor } from '../../utils'
import CategoryImageSelector from './CategoryImageSelector'

const STORAGE_KEY = 'image_classification_results'

const { Text } = Typography

interface ClassificationModel {
  id: string
  name: string
  description: string
  sizeMB: number
}

const ManualDownloadModal: React.FC<{
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  modelId?: string
  downloadUrls?: string[]
}> = ({ visible, onClose, onSuccess, modelId, downloadUrls = [] }) => {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      await handleSaveFile(file.path)
    }
  }, [])

  const handleSelectFile = async () => {
    const modelPath = await (window.electronAPI as any)?.selectAndSaveModelFile?.()
    if (modelPath) {
      onSuccess()
    }
  }

  const handleSaveFile = async (sourcePath: string) => {
    try {
      const modelPath = await (window.electronAPI as any)?.saveModelFile?.(sourcePath)
      if (modelPath) {
        message.success('模型文件已保存！')
        onSuccess()
      } else {
        message.error('保存失败')
      }
    } catch (error) {
      message.error('保存失败: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

  // 从URL中提取链接名称
  const getLinkName = (url: string, index: number): string => {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const fileName = pathname.split('/').pop() || ''
      if (fileName) return fileName
    } catch {}
    // 备用名称
    const names = ['GitHub 主链接', '备用链接 1', '备用链接 2']
    return names[index] || `下载链接 ${index + 1}`
  }

  const handleOpenLink = async (url: string) => {
    await (window.electronAPI as any)?.openExternalLink?.(url)
  }

  return (
    <Modal
      title="手动下载模型"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="自动下载失败，请手动下载模型文件"
          description={
            <Space direction="vertical" size="small">
              <Text>请点击以下链接下载模型文件：</Text>
              {downloadUrls.length > 0 ? (
                <Space direction="vertical" size="small" style={{ marginTop: 8 }}>
                  {downloadUrls.map((url, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DownloadOutlined style={{ color: '#1890ff' }} />
                      <a onClick={() => handleOpenLink(url)} style={{ fontSize: 13 }}>
                        {getLinkName(url, index)}
                      </a>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ({url.includes('github') ? 'GitHub' : '备用源'})
                      </Text>
                    </div>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">
                  下载链接: <a onClick={() => handleOpenLink('https://github.com/onnx/models')}>GitHub ONNX Models</a> (请搜索 {modelId || 'mobilenetv2'}.onnx)
                </Text>
              )}
              <Text type="secondary" style={{ marginTop: 8 }}>
                下载后请将文件重命名为: <Text strong copyable>{modelId || 'mobilenetv2'}.onnx</Text>
              </Text>
            </Space>
          }
          type="info"
          showIcon
          action={
            downloadUrls.length > 0 ? (
              <Button
                size="small"
                type="primary"
                onClick={() => handleOpenLink(downloadUrls[0])}
              >
                在浏览器中打开
              </Button>
            ) : undefined
          }
        />

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? '#1890ff' : '#d9d9d9'}`,
            borderRadius: 8,
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: isDragging ? '#e6f7ff' : '#fafafa',
            transition: 'all 0.3s',
            cursor: 'pointer'
          }}
          onClick={handleSelectFile}
        >
          <InboxOutlined style={{ fontSize: 48, color: isDragging ? '#1890ff' : '#999' }} />
          <p style={{ marginTop: 16, marginBottom: 8, fontSize: 16 }}>
            {isDragging ? '释放文件以保存' : '点击或拖拽模型文件到此区域'}
          </p>
          <Text type="secondary">
            支持 .onnx 格式文件，请选择已下载的 {modelId || 'mobilenetv2'}.onnx 文件
          </Text>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Button icon={<FolderOpenOutlined />} onClick={handleSelectFile}>
            或从文件管理器选择文件
          </Button>
        </div>

        <Alert
          message="提示"
          description={`模型文件将保存到项目的 models/ 目录下，文件名为 ${modelId || 'mobilenetv2'}.onnx`}
          type="success"
          showIcon
        />
      </Space>
    </Modal>
  )
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

interface ClassificationResult {
  key: number
  filePath: string
  fileName: string
  category: ImageContentCategory
  confidence: number
}

const ImageClassification: React.FC = () => {
  const { currentPath: globalCurrentPath } = useFileStore()

  const [classificationPath, setClassificationPath] = useState<string | null>(null)

  useEffect(() => {
    if (globalCurrentPath) {
      setClassificationPath(globalCurrentPath)
    }
  }, [globalCurrentPath])

  const handleSelectClassificationDirectory = useCallback(async () => {
    if (!window.electronAPI?.openDirectory) {
      message.error('选择目录功能不可用')
      return
    }
    try {
      const path = await window.electronAPI.openDirectory()
      if (path) {
        const normalizedPath = path.replace(/\\/g, '/')
        setClassificationPath(normalizedPath)
        message.success('已选择分类目录')
      }
    } catch (error) {
      message.error('选择目录失败')
    }
  }, [])

  const [results, setResults] = useState<Map<string, ImageClassificationResult>>(new Map())
  const [isClassifying, setIsClassifying] = useState(false)
  const [progress, setProgress] = useState<ImageClassificationProgress | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'completed' | 'error'>('idle')
  const [modelExists, setModelExists] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [manualDownloadModalVisible, setManualDownloadModalVisible] = useState(false)
  const [failedDownloadUrls, setFailedDownloadUrls] = useState<string[]>([])
  const [viewerVisible, setViewerVisible] = useState(false)
  const [viewerImages, setViewerImages] = useState<Image[]>([])
  const [viewerCurrentIndex, setViewerCurrentIndex] = useState(0)
  const [availableModels, setAvailableModels] = useState<ClassificationModel[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('mobilenetv2')
  const [modelExistsMap, setModelExistsMap] = useState<Record<string, boolean>>({})

  // 分类图片选择器状态
  const [categorySelectorVisible, setCategorySelectorVisible] = useState(false)
  const [categorySelectorImages, setCategorySelectorImages] = useState<Image[]>([])
  const [categorySelectorLabel, setCategorySelectorLabel] = useState('')

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onImageClassificationProgress) {
      const unsubscribe = window.electronAPI.onImageClassificationProgress((prog) => {
        setProgress(prog)
        if (prog.status === 'completed' || prog.status === 'error') {
          setIsClassifying(false)
        }
      })
      return () => {
        unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    const loadModels = async () => {
      if (window.electronAPI && window.electronAPI.getAvailableModels) {
        const models = await window.electronAPI.getAvailableModels()
        setAvailableModels(models)

        const existsMap: Record<string, boolean> = {}
        for (const model of models) {
          const exists = await window.electronAPI.checkModelExists(model.id)
          existsMap[model.id] = exists
        }
        setModelExistsMap(existsMap)
        setModelExists(existsMap[selectedModel] || false)
      } else if (window.electronAPI && window.electronAPI.checkModelExists) {
        const exists = await window.electronAPI.checkModelExists()
        setModelExists(exists)
        setModelExistsMap({ mobilenetv2: exists })
      }
    }

    loadModels()

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const resultsArray: Array<[string, ImageClassificationResult]> = JSON.parse(saved)
        const loadedResults = new Map(resultsArray)
        setResults(loadedResults)
        console.log(`[分类] 已加载 ${loadedResults.size} 条保存的分类结果`)
      }
    } catch (e) {
      console.warn('加载分类结果失败:', e)
    }
  }, [selectedModel])

  const handleDownloadModel = () => {
    const model = availableModels.find(m => m.id === selectedModel) || availableModels[0]
    const modelName = model?.name || 'MobileNetV2'
    const modelSize = model?.sizeMB || 14

    Modal.confirm({
      title: '下载分类模型',
      content: `确定要下载 ${modelName} 模型吗？模型文件约 ${modelSize}MB，需要联网下载。`,
      okText: '确定下载',
      cancelText: '取消',
      onOk: async () => {
        setIsDownloading(true)
        setDownloadStatus('downloading')
        setDownloadProgress(0)

        abortControllerRef.current = new AbortController()

        try {
          if (window.electronAPI && window.electronAPI.downloadModel) {
            const result = await window.electronAPI.downloadModel(
              selectedModel,
              (progress: number) => {
                setDownloadProgress(progress)
              },
              abortControllerRef.current!.signal
            )

            if (result.success) {
              setDownloadStatus('completed')
              setModelExists(true)
              setModelExistsMap(prev => ({ ...prev, [selectedModel]: true }))
              message.success('模型下载成功！')
            } else if (result.cancelled) {
              setDownloadStatus('idle')
              message.info('下载已取消')
            } else {
              setDownloadStatus('error')
              const errorMsg = result.error || '未知错误'
              setFailedDownloadUrls(result.downloadUrls || [])
              if (errorMsg.includes('无法找到模型文件') || errorMsg.includes('HTTP 404')) {
                setManualDownloadModalVisible(true)
              } else {
                message.error('下载失败: ' + errorMsg)
              }
            }
          } else {
            message.error('下载功能不可用')
            setDownloadStatus('error')
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            setDownloadStatus('idle')
            message.info('下载已取消')
          } else {
            setDownloadStatus('error')
            message.error('下载失败: ' + (error instanceof Error ? error.message : String(error)))
          }
        } finally {
          setIsDownloading(false)
          abortControllerRef.current = null
        }
      }
    })
  }

  const handleCancelDownload = () => {
    abortControllerRef.current?.abort()
  }

  const handleClassify = async () => {
    if (!classificationPath) {
      const path = await window.electronAPI?.openDirectory()
      if (path) {
        const normalizedPath = path.replace(/\\/g, '/')
        setClassificationPath(normalizedPath)
        message.success('已选择分类目录')
      } else {
        return
      }
    }
    
    console.log('[分类] handleClassify 被调用')
    console.log('[分类] modelExists:', modelExists)
    console.log('[分类] classificationPath:', classificationPath)
    console.log('[分类] selectedModel:', selectedModel)
    
    if (!window.electronAPI?.classifyImagesBatch) {
      console.error('[分类] classifyImagesBatch 不可用')
      message.error('分类功能不可用')
      return
    }

    if (!modelExists) {
      console.warn('[分类] 模型不存在，modelExists:', modelExists)
      message.warning('请先下载分类模型')
      return
    }

    if (!classificationPath) {
      console.warn('[分类] 未选择目录')
      message.warning('请先选择目录')
      return
    }

    try {
      setIsClassifying(true)
      setProgress({ current: 0, total: 0, status: 'loading' })

      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
      
      const imagePaths: string[] = []
      
      const scanImages = async (dir: string) => {
        try {
          const entries = await window.electronAPI!.readDirectory(dir)
          for (const entry of entries) {
            const fullPath = entry.path
            if (entry.isDirectory) {
              await scanImages(fullPath)
            } else {
              const ext = entry.name.toLowerCase().split('.').pop()
              if (ext && imageExtensions.includes(ext)) {
                imagePaths.push(fullPath)
              }
            }
          }
        } catch (error) {
          console.error('扫描目录失败:', dir, error)
        }
      }
      
      console.log('[分类] 开始扫描目录:', classificationPath)
      await scanImages(classificationPath)
      console.log('[分类] 扫描完成，找到', imagePaths.length, '张图片')

      if (imagePaths.length === 0) {
        message.warning('当前目录没有找到图片文件')
        setIsClassifying(false)
        return
      }

      console.log('[分类] 开始调用 classifyImagesBatch')
      const result = await window.electronAPI.classifyImagesBatch({
        imagePaths,
        batchSize: 10,
        modelId: selectedModel
      })
      console.log('[分类] classifyImagesBatch 返回:', result)

      const newResults = new Map<string, ImageClassificationResult>()
      for (const r of result.results) {
        newResults.set(r.filePath, r)
      }
      setResults(newResults)
      console.log('[分类] 结果已设置，共', newResults.size, '条')

      try {
        const resultsArray = Array.from(newResults.entries())
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resultsArray))
      } catch (e) {
        console.warn('保存分类结果失败:', e)
      }

      message.success(`分类完成：成功 ${result.successCount} 张，失败 ${result.errorCount} 张`)
      setIsClassifying(false)
    } catch (error) {
      console.error('[分类] 分类失败:', error)
      message.error('分类失败: ' + (error instanceof Error ? error.message : String(error)))
      setIsClassifying(false)
    }
  }

  const handleClearResults = () => {
    setResults(new Map())
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.warn('清除分类结果失败:', e)
    }
    message.info('已清除分类结果')
  }

   const handleViewImage = async (filePath: string) => {
     try {
       const allImages: Image[] = []
       let currentIndex = 0

       for (const [path, classification] of results.entries()) {
         const fileName = path.split(/[/\\]/).pop() || path

         let width = 0, height = 0
         let imageUrl = `file://${path}`
         
         // 尝试从缓存获取已加载的图片数据
         try {
           const cachedData = localStorage.getItem(`image_data_${path}`)
           if (cachedData) {
             const cached = JSON.parse(cachedData)
             if (cached.url && cached.width > 0 && cached.height > 0) {
               width = cached.width
               height = cached.height
               imageUrl = cached.url
             }
           }
         } catch (e) {
           console.warn('读取缓存图片数据失败:', path)
         }

         // 如果没有缓存，尝试获取尺寸
         if (width === 0 || height === 0) {
           try {
             const dims = await window.electronAPI?.getImageDimensions(path)
             if (dims && dims.width > 0 && dims.height > 0) {
               width = dims.width
               height = dims.height
             }
           } catch (e) {
             console.warn('获取图片尺寸失败:', path)
           }
         }

         const image: Image = {
           id: path,
           url: imageUrl,
           filename: fileName,
           width,
           height,
           size: 0,
           format: 'unknown',
           createdAt: new Date().toISOString(),
           modifiedAt: new Date().toISOString(),
           classification: {
             filePath: path,
             category: classification.category,
             confidence: classification.confidence,
             topPredictions: classification.topPredictions
           }
         }

         allImages.push(image)

         if (path === filePath) {
           currentIndex = allImages.length - 1
         }
       }

       setViewerImages(allImages)
       setViewerCurrentIndex(currentIndex)
       setViewerVisible(true)
     } catch (error) {
       message.error('打开图片失败: ' + (error instanceof Error ? error.message : String(error)))
     }
   }

   // 分类标签映射
const CATEGORY_NAME_MAP: Record<string, string> = {
   person: '人物', portrait: '人像', selfie: '自拍',
   dog: '狗', cat: '猫', bird: '鸟类', wild_animal: '野生动物', marine_animal: '海洋生物', insect: '昆虫', pet: '宠物',
   landscape: '风景', mountain: '山脉', beach: '海滩', sunset: '日落', forest: '森林', cityscape: '城市风光', night_scene: '夜景',
   building: '建筑', landmark: '地标', interior: '室内', street: '街道',
   food: '食物', drink: '饮品', dessert: '甜点',
   vehicle: '车辆', aircraft: '飞机', ship: '船舶',
   art: '艺术', technology: '科技', document: '文档', other: '其他'
 }

 const handleViewCategory = async (categories: ImageContentCategory[], categoryName: string) => {
     try {
       const allImages: Image[] = []

       // 过滤出属于指定分类的图片
       const filteredResults = Array.from(results.entries()).filter(([_, classification]) => 
         categories.includes(classification.category)
       )

       for (const [path, classification] of filteredResults) {
         const fileName = path.split(/[/\\]/).pop() || path

         let width = 0, height = 0
         let imageUrl = `file://${path}`
         
         // 尝试从缓存获取已加载的图片数据
         try {
           const cachedData = localStorage.getItem(`image_data_${path}`)
           if (cachedData) {
             const cached = JSON.parse(cachedData)
             if (cached.url && cached.width > 0 && cached.height > 0) {
               width = cached.width
               height = cached.height
               imageUrl = cached.url
             }
           }
         } catch (e) {
           console.warn('读取缓存图片数据失败:', path)
         }

         // 如果没有缓存，尝试获取尺寸
         if (width === 0 || height === 0) {
           try {
             const dims = await window.electronAPI?.getImageDimensions(path)
             if (dims && dims.width > 0 && dims.height > 0) {
               width = dims.width
               height = dims.height
             }
           } catch (e) {
             console.warn('获取图片尺寸失败:', path)
           }
         }

         const image: Image = {
           id: path,
           url: imageUrl,
           filename: fileName,
           width,
           height,
           size: 0,
           format: 'unknown',
           createdAt: new Date().toISOString(),
           modifiedAt: new Date().toISOString(),
           classification: {
             filePath: path,
             category: classification.category,
             confidence: classification.confidence,
             topPredictions: classification.topPredictions
           }
         }

         allImages.push(image)
       }

       // 如果有匹配的图片，打开选择器模态窗口
       if (allImages.length > 0) {
         setCategorySelectorImages(allImages)
         setCategorySelectorLabel(categoryName)
         setCategorySelectorVisible(true)
       } else {
         message.warning('该分类下暂无图片')
       }
     } catch (error) {
       message.error('查看分类图片失败: ' + (error instanceof Error ? error.message : String(error)))
     }
   }

   // 处理选择图片后打开大图
   const handleCategoryImageSelect = (image: Image) => {
     setViewerImages([image])
     setViewerCurrentIndex(0)
     setViewerVisible(true)
   }

  const tableData: ClassificationResult[] = Array.from(results.values()).map((r, i) => ({
    key: i,
    filePath: r.filePath,
    fileName: r.filePath.split(/[/\\]/).pop() || r.filePath,
    category: r.category,
    confidence: r.confidence
  }))

  const columns = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
      render: (fileName: string, record: ClassificationResult) => (
        <a onClick={() => handleViewImage(record.filePath)}>{fileName}</a>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: ImageContentCategory) => (
        <CategoryTag
          color={getCategoryTagColor(category)}
          label={CATEGORY_LABELS[category] || category}
        />
      )
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (confidence: number) => (
        <Progress
          percent={Math.round(confidence * 100)}
          size="small"
          status={confidence > 0.8 ? 'success' : confidence > 0.5 ? 'normal' : 'exception'}
        />
      )
    }
  ]

  // 分类统计数据
  const stats = {
    total: results.size,
    success: Array.from(results.values()).filter(r => r.confidence > 0).length,
    // 人物类
    people: Array.from(results.values()).filter(r => ['person', 'portrait', 'selfie'].includes(r.category)).length,
    // 动物类
    animals: Array.from(results.values()).filter(r => ['dog', 'cat', 'bird', 'wild_animal', 'marine_animal', 'insect', 'pet'].includes(r.category)).length,
    // 风景类
    landscapes: Array.from(results.values()).filter(r => ['landscape', 'mountain', 'beach', 'sunset', 'forest', 'cityscape', 'night_scene'].includes(r.category)).length,
    // 建筑类
    buildings: Array.from(results.values()).filter(r => ['building', 'landmark', 'interior', 'street'].includes(r.category)).length,
    // 食物类
    food: Array.from(results.values()).filter(r => ['food', 'drink', 'dessert'].includes(r.category)).length,
    // 交通类
    transportation: Array.from(results.values()).filter(r => ['vehicle', 'aircraft', 'ship'].includes(r.category)).length,
    // 其他类
    other: Array.from(results.values()).filter(r => ['art', 'technology', 'document', 'other'].includes(r.category)).length
  }

  // 详细分类统计
  const detailedStats = {
    // 人物类
    person: Array.from(results.values()).filter(r => r.category === 'person').length,
    portrait: Array.from(results.values()).filter(r => r.category === 'portrait').length,
    selfie: Array.from(results.values()).filter(r => r.category === 'selfie').length,
    // 动物类
    dog: Array.from(results.values()).filter(r => r.category === 'dog').length,
    cat: Array.from(results.values()).filter(r => r.category === 'cat').length,
    bird: Array.from(results.values()).filter(r => r.category === 'bird').length,
    wild_animal: Array.from(results.values()).filter(r => r.category === 'wild_animal').length,
    marine_animal: Array.from(results.values()).filter(r => r.category === 'marine_animal').length,
    insect: Array.from(results.values()).filter(r => r.category === 'insect').length,
    pet: Array.from(results.values()).filter(r => r.category === 'pet').length,
    // 风景类
    landscape: Array.from(results.values()).filter(r => r.category === 'landscape').length,
    mountain: Array.from(results.values()).filter(r => r.category === 'mountain').length,
    beach: Array.from(results.values()).filter(r => r.category === 'beach').length,
    sunset: Array.from(results.values()).filter(r => r.category === 'sunset').length,
    forest: Array.from(results.values()).filter(r => r.category === 'forest').length,
    cityscape: Array.from(results.values()).filter(r => r.category === 'cityscape').length,
    night_scene: Array.from(results.values()).filter(r => r.category === 'night_scene').length,
    // 建筑类
    building: Array.from(results.values()).filter(r => r.category === 'building').length,
    landmark: Array.from(results.values()).filter(r => r.category === 'landmark').length,
    interior: Array.from(results.values()).filter(r => r.category === 'interior').length,
    street: Array.from(results.values()).filter(r => r.category === 'street').length,
    // 食物类
    food: Array.from(results.values()).filter(r => r.category === 'food').length,
    drink: Array.from(results.values()).filter(r => r.category === 'drink').length,
    dessert: Array.from(results.values()).filter(r => r.category === 'dessert').length,
    // 交通类
    vehicle: Array.from(results.values()).filter(r => r.category === 'vehicle').length,
    aircraft: Array.from(results.values()).filter(r => r.category === 'aircraft').length,
    ship: Array.from(results.values()).filter(r => r.category === 'ship').length,
    // 其他类
    art: Array.from(results.values()).filter(r => r.category === 'art').length,
    technology: Array.from(results.values()).filter(r => r.category === 'technology').length,
    document: Array.from(results.values()).filter(r => r.category === 'document').length,
    other: Array.from(results.values()).filter(r => r.category === 'other').length
  }

  // 计算平均置信度
  const avgConfidence = results.size > 0 ? 
    Array.from(results.values()).reduce((sum, r) => sum + r.confidence, 0) / results.size : 0

  // Render model download status tag
  const renderModelStatusTag = () => {
    switch (downloadStatus) {
      case 'downloading':
        return <Tag color="blue" style={{ marginLeft: 8 }} icon={<DownloadOutlined />}>下载中</Tag>
      case 'completed':
        return <Tag color="green" style={{ marginLeft: 8 }} icon={<CheckCircleOutlined />}>已就绪</Tag>
      case 'error':
        return <Tag color="red" style={{ marginLeft: 8 }} icon={<FrownOutlined />}>下载失败</Tag>
      default:
        return <Tag color="orange" style={{ marginLeft: 8 }} icon={<InboxOutlined />}>未下载</Tag>
    }
  }

  return (
    <Card
      title={
        <Space>
          <ApiOutlined />
          <span>图片内容分类</span>
          {modelExists && (
            <Tag color="success" icon={<CheckCircleOutlined />}>模型已就绪</Tag>
          )}
          {!modelExists && (
            <Tag color="warning">模型未下载</Tag>
          )}
        </Space>
      }
      extra={
        <div className="classification-toolbar__actions">
          <Select
            value={selectedModel}
            onChange={(value) => {
              setSelectedModel(value)
              setModelExists(modelExistsMap[value] || false)
            }}
            style={{ width: 160 }}
            disabled={isDownloading || isClassifying}
          >
            {availableModels.map(model => (
              <Select.Option key={model.id} value={model.id}>
                {model.name}
                {modelExistsMap[model.id] ? ' ✓' : ''}
              </Select.Option>
            ))}
          </Select>
          {renderModelStatusTag()}
          {results.size > 0 && (
            <Button icon={<DeleteOutlined />} onClick={handleClearResults}>
              清除结果
            </Button>
          )}
          {!modelExists && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadModel}
              loading={isDownloading}
            >
              {isDownloading ? '下载中...' : '下载模型'}
            </Button>
          )}
          <Button
            type="primary"
            icon={<ApiOutlined />}
            onClick={handleClassify}
            loading={isClassifying}
            disabled={!modelExists}
          >
            {isClassifying ? '分类中...' : '开始分类'}
          </Button>
          {!classificationPath && (
            <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
              (请先选择目录)
            </span>
          )}
        </div>
      }
      className="app-surface-card"
      style={{ height: '100%', overflow: 'auto' }}
      bodyStyle={{ padding: '16px' }}
    >
      {!classificationPath ? (
        <div className="app-empty-state is-panel">
          <FolderOpenOutlined className="app-empty-state__icon" />
          <div className="app-empty-state__title">请先选择要分类的图片目录</div>
          <div className="app-empty-state__description">点击下方按钮选择包含图片的文件夹，再下载模型并开始分类。</div>
          <Button 
            type="primary" 
            icon={<FolderOpenOutlined />} 
            size="large"
            onClick={handleSelectClassificationDirectory}
          >
            选择目录
          </Button>
        </div>
      ) : (
        <div className="classification-page">
          {!modelExists && downloadStatus !== 'downloading' && (
            <Alert
              message="模型未下载"
              description={
                <Space direction="vertical" size="small">
                  <Text>分类功能需要下载 {availableModels.find(m => m.id === selectedModel)?.name || '模型'} 才能正常工作。</Text>
                  <Text type="secondary">模型文件约 {availableModels.find(m => m.id === selectedModel)?.sizeMB || 14}MB，下载后保存在 models/ 目录下。</Text>
                </Space>
              }
              type="info"
              showIcon
              action={
                <Button
                  size="small"
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadModel}
                >
                  下载模型
                </Button>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          {isDownloading && downloadProgress !== null && (
            <PageSection title="正在下载模型" subtitle="模型会保存在本地 models 目录中">
              <Progress
                percent={downloadProgress}
                status="active"
                format={(percent) => `${percent?.toFixed(1)}%`}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">下载约 14MB 的模型文件...</Text>
              </div>
              <div style={{ marginTop: 12 }}>
                <Button size="small" danger onClick={handleCancelDownload}>
                  取消下载
                </Button>
              </div>
            </PageSection>
          )}

          {classificationPath && (
            <div className="classification-path-chip">
              <div>
                <Text strong style={{ color: 'var(--app-primary)' }}>当前目录: </Text>
                <Text code style={{ fontSize: 12 }}>{classificationPath}</Text>
              </div>
              <Button 
                size="small" 
                icon={<FolderOpenOutlined />} 
                onClick={handleSelectClassificationDirectory}
                disabled={isClassifying}
              >
                重新选择
              </Button>
            </div>
          )}

          {isClassifying && progress && (
            <div style={{ marginBottom: 16 }}>
              <Progress
                percent={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
                status="active"
                format={() => (
                  <span style={{ fontSize: 12 }}>
                    {progress.status === 'loading' && '正在扫描图片...'}
                    {progress.status === 'classifying' && `正在分类: ${progress.current}/${progress.total}`}
                    {progress.status === 'completed' && '分类完成'}
                  </span>
                )}
              />
            </div>
          )}

          {stats.total > 0 && !isClassifying && (
            <>
              <PageSection title="分类概览" subtitle="以统一统计卡展示识别总量与主要类型分布">
                <div className="classification-stats-grid">
                  <StatCard title="总计" value={stats.total} icon={<CheckCircleOutlined />} accent="var(--app-success)" subtle />
                  <StatCard title="成功" value={stats.success} icon={<ApiOutlined />} accent="var(--app-primary)" subtle />
                  <StatCard title="平均置信度" value={`${Math.round(avgConfidence * 100)}%`} icon={<CheckCircleOutlined />} accent="var(--app-warning)" subtle />
                </div>
                <div className="classification-stats-grid">
                  <StatCard title="人物" value={stats.people} icon={<UserOutlined />} accent={getCategoryTagColor('person')} onClick={() => handleViewCategory(['person', 'portrait', 'selfie'], '人物')} />
                  <StatCard title="动物" value={stats.animals} icon={<FrownOutlined />} accent={getCategoryTagColor('dog')} onClick={() => handleViewCategory(['dog', 'cat', 'bird', 'wild_animal', 'marine_animal', 'insect', 'pet'], '动物')} />
                  <StatCard title="风景" value={stats.landscapes} icon={<PictureOutlined />} accent={getCategoryTagColor('landscape')} onClick={() => handleViewCategory(['landscape', 'mountain', 'beach', 'sunset', 'forest', 'cityscape', 'night_scene'], '风景')} />
                  <StatCard title="建筑" value={stats.buildings} icon={<BuildOutlined />} accent={getCategoryTagColor('building')} onClick={() => handleViewCategory(['building', 'landmark', 'interior', 'street'], '建筑')} />
                  <StatCard title="食物" value={stats.food} icon={<CoffeeOutlined />} accent={getCategoryTagColor('food')} onClick={() => handleViewCategory(['food', 'drink', 'dessert'], '食物')} />
                  <StatCard title="交通" value={stats.transportation} icon={<CarOutlined />} accent={getCategoryTagColor('vehicle')} onClick={() => handleViewCategory(['vehicle', 'aircraft', 'ship'], '交通')} />
                  <StatCard title="其他" value={stats.other} icon={<AppstoreOutlined />} accent={getCategoryTagColor('other')} onClick={() => handleViewCategory(['art', 'technology', 'document', 'other'], '其他')} />
                </div>
              </PageSection>

              <PageSection title="分类结果" subtitle={`共 ${tableData.length} 项结果，可点击文件名查看图片`}>
                <Table
                  columns={columns}
                  dataSource={tableData}
                  pagination={{ 
                    pageSize: 15, 
                    showSizeChanger: true, 
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 项`
                  }}
                  size="middle"
                  scroll={{ y: 400 }}
                  style={{ marginTop: 8 }}
                />
              </PageSection>
            </>
          )}

          {stats.total === 0 && !isClassifying && !isDownloading && (
            <div className="app-empty-state">
              <ApiOutlined className="app-empty-state__icon" />
              {modelExists ? (
                <>
                  <p className="app-empty-state__title">点击“开始分类”分析当前目录图片内容</p>
                  <p className="app-empty-state__description">支持人物、动物、风景、建筑、食物、交通等 25 个细分类别的智能识别。</p>
                </>
              ) : (
                <>
                  <p className="app-empty-state__title">请先下载分类模型，然后再开始识别</p>
                  <p className="app-empty-state__description">模型文件约 14MB，下载后保存在本地。</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 图片查看器 */}
      {viewerVisible && viewerImages.length > 0 && (
        <ImageViewer
          images={viewerImages}
          currentIndex={viewerCurrentIndex}
          onIndexChange={setViewerCurrentIndex}
          onClose={() => setViewerVisible(false)}
        />
      )}

      {/* 分类图片选择器模态窗口 */}
      <CategoryImageSelector
        visible={categorySelectorVisible}
        images={categorySelectorImages}
        categoryLabel={categorySelectorLabel}
        onClose={() => setCategorySelectorVisible(false)}
        onConfirm={handleCategoryImageSelect}
      />

      {/* 手动下载 Modal */}
      <ManualDownloadModal
        visible={manualDownloadModalVisible}
        modelId={selectedModel}
        downloadUrls={failedDownloadUrls}
        onClose={() => setManualDownloadModalVisible(false)}
        onSuccess={() => {
          setModelExists(true)
          setModelExistsMap(prev => ({ ...prev, [selectedModel]: true }))
          setManualDownloadModalVisible(false)
        }}
      />
    </Card>
  )
}

export default ImageClassification
