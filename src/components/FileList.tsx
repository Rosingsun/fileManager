import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Table, Card, Switch, Tag, Space, Empty, Modal, Input, message, Button, AutoComplete, Checkbox, Select } from 'antd'
import { Button as AntButton } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  FileOutlined,
  FolderOutlined,
  PictureOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  FileZipOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  LeftOutlined,
  FilterOutlined,
  ClearOutlined
} from '@ant-design/icons'
import { useFileStore, FILE_CATEGORIES } from '../stores/fileStore'
import { useFileSystem } from '../hooks/useFileSystem'
import { formatFileSize, formatDateTime, getFileExtension, getFileTypeIcon, filterFiles } from '../utils/fileUtils'
import { imageLoader } from '../utils/imageLoader'
import { imageCache } from '../utils/imageCache'
import type { FileInfo } from '../types'
import ImageViewer from './ImageViewer'
import type { Image } from './ImageViewer'
import CircularProgress from './CircularProgress'

const FileList: React.FC = () => {
  const MAX_IMAGE_SIZE = 50 * 1024 * 1024

  const { fileList, loading, currentPath, historyList, selectedCategory, selectedSubExtensions, setSelectedCategory, setSelectedSubExtensions, resetFilter } = useFileStore()
  const { loadDirectory } = useFileSystem()
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renamingFile, setRenamingFile] = useState<FileInfo | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deletingFile, setDeletingFile] = useState<FileInfo | null>(null)
  const [imagePreviews, setImagePreviews] = useState<Map<string, { thumbnail: string; full: string }>>(new Map())
  const [visibleImages, setVisibleImages] = useState<Set<string>>(new Set())
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set())
  const [imageProgress, setImageProgress] = useState<Map<string, number>>(new Map()) // 图片加载进度
  const observerRef = useRef<IntersectionObserver | null>(null)
  const imageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number>(0)
  const [previewImages, setPreviewImages] = useState<Image[]>([])
  const [previewableFiles, setPreviewableFiles] = useState<FileInfo[]>([])
  const [previewEnabled] = useState(true) // 预览开关，默认打开
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [selectedRows, setSelectedRows] = useState<FileInfo[]>([])
  const [batchRenameModalVisible, setBatchRenameModalVisible] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list') // 视图模式：列表视图/网格视图
  const [batchRenamePrefix, setBatchRenamePrefix] = useState('')
  const [batchRenameSuffix, setBatchRenameSuffix] = useState('')
  const [moveModalVisible, setMoveModalVisible] = useState(false)
  const [moveTargetPath, setMoveTargetPath] = useState('')
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [pageSizeOptions] = useState(['15', '30', '75', '150', '300']) // 页码选择范围

  // 当目录切换时，清空图片预览缓存
  useEffect(() => {
    setImagePreviews(new Map())
    setVisibleImages(new Set())
    setLoadingImages(new Set())
    setImageProgress(new Map())
    
    // 清理图片加载器缓存（可选，根据需要）
    // imageLoader.clearCache()
    
    // 清理之前的观察
    if (observerRef.current) {
      imageRefs.current.forEach((element) => {
        observerRef.current?.unobserve(element)
      })
    }
    imageRefs.current.clear()
    
    // 输出缓存统计信息
    const stats = imageLoader.getCacheStats()
    const hitRate = imageLoader.getHitRate()
    console.log(`[FileList] 目录切换，缓存统计: 项目数=${stats.itemCount}, 总大小=${(stats.totalSize / 1024 / 1024).toFixed(1)}MB, 命中率=${hitRate}%`)
  }, [currentPath])

  // 当文件列表或 observer 变化时，重新观察所有已注册的元素
  useEffect(() => {
    if (!previewEnabled || !observerRef.current) return

    // 延迟执行，确保DOM已渲染
    const timer = setTimeout(() => {
      if (observerRef.current) {
        imageRefs.current.forEach((element) => {
          if (element && observerRef.current) {
            observerRef.current.observe(element)
          }
        })
      }
    }, 50)

    return () => clearTimeout(timer)
  }, [fileList, previewEnabled])

  // 加载图片预览（优化版本 - 智能缓存和批量加载）
  useEffect(() => {
    if (!previewEnabled) {
      setImagePreviews(new Map())
      setVisibleImages(new Set())
      setLoadingImages(new Set())
      return
    }

    // 初始化Intersection Observer - 增加预加载距离和优化触发条件
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const filePath = (entry.target as HTMLElement).dataset.filePath
          if (!filePath) return

          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            // 图片进入视口或部分可见，开始加载
            setVisibleImages(prev => {
              if (!prev.has(filePath)) {
                return new Set([...prev, filePath])
              }
              return prev
            })
          }
        })
      },
      {
        rootMargin: '200px', // 增加到200px，提前更多开始加载
        threshold: 0.01 // 降低阈值，更早触发
      }
    )

    observerRef.current = observer

    // 清理之前的观察
    imageRefs.current.forEach((element) => {
      if (element) {
        observer.unobserve(element)
      }
    })
    imageRefs.current.clear()

    // 立即观察已存在的元素
    const observeElements = () => {
      if (observerRef.current) {
        imageRefs.current.forEach((element) => {
          if (element && observerRef.current) {
            try {
              observerRef.current.observe(element)
            } catch (error) {
              console.warn('观察元素失败:', error)
            }
          }
        })
      }
    }

    // 使用双重定时器确保DOM完全渲染
    requestAnimationFrame(() => {
      setTimeout(observeElements, 50)
    })

    return () => {
      observer.disconnect()
    }
  }, [previewEnabled])

  // 带进度跟踪的图片加载函数
  const loadThumbnailWithProgress = async (filePath: string, _file: FileInfo): Promise<{ data: string; fromCache: boolean }> => {
    // 先检查缓存，如果从缓存加载，直接返回，不显示进度条
    const cacheKey = `thumb:${filePath}:300:80`
    const cached = imageCache.get(cacheKey)
    if (cached) {
      return { data: cached, fromCache: true }
    }

    // 初始化进度
    setImageProgress(prev => {
      const m = new Map(prev)
      m.set(filePath, 0)
      return m
    })

    // 模拟进度更新（因为 electronAPI 不提供进度回调）
    const progressInterval = setInterval(() => {
      setImageProgress(prev => {
        const m = new Map(prev)
        const currentProgress = m.get(filePath) || 0
        if (currentProgress < 90) {
          // 在0-90%之间缓慢增长
          m.set(filePath, Math.min(currentProgress + Math.random() * 10, 90))
        }
        return m
      })
    }, 100)

    try {
      const result = await imageLoader.loadThumbnail(filePath, 300, 80, {
        useCache: true,
        timeout: 15000,
        retryCount: 2
      })

      // 加载完成，设置进度为100%
      clearInterval(progressInterval)
      setImageProgress(prev => {
        const m = new Map(prev)
        m.set(filePath, 100)
        return m
      })

      // 短暂延迟后清除进度（让用户看到100%）
      setTimeout(() => {
        setImageProgress(prev => {
          const m = new Map(prev)
          m.delete(filePath)
          return m
        })
      }, 300)

      return { data: result.data, fromCache: result.fromCache }
    } catch (error) {
      clearInterval(progressInterval)
      setImageProgress(prev => {
        const m = new Map(prev)
        m.delete(filePath)
        return m
      })
      throw error
    }
  }

  // 加载可见图片的缩略图（优化版本 - 智能缓存和优先级加载）
  useEffect(() => {
    if (!previewEnabled || visibleImages.size === 0) return

    let mounted = true

    const loadVisibleThumbnails = async () => {
      const imagesToLoad = Array.from(visibleImages).filter(path =>
        !imagePreviews.has(path) && !loadingImages.has(path)
      )

      if (imagesToLoad.length === 0) return

      // 标记正在加载
      setLoadingImages(prev => new Set([...prev, ...imagesToLoad]))

      // 优化并发度和批次处理
      const CONCURRENCY = 4 // 增加并发度
      let index = 0

      // 按文件大小排序，优先加载小图片
      const sortedImages = imagesToLoad.sort((a, b) => {
        const fileA = fileList.find(f => f.path === a)
        const fileB = fileList.find(f => f.path === b)
        return (fileA?.size || 0) - (fileB?.size || 0)
      })

      const worker = async () => {
        while (true) {
          const i = index
          index += 1
          if (i >= sortedImages.length) break
          const filePath = sortedImages[i]

          try {
            // 检查文件大小，只对小于等于50MB的图片生成缩略图
            const file = fileList.find(f => f.path === filePath)
            if (!file || file.size > MAX_IMAGE_SIZE) {
              console.log(`跳过大于50MB的图片缩略图生成: ${filePath}`)
              if (mounted) {
                setLoadingImages(prev => {
                  const newSet = new Set(prev)
                  newSet.delete(filePath)
                  return newSet
                })
              }
              continue
            }
            
            // 使用带进度跟踪的图片加载器
            console.log(`[FileList] 正在加载预览图片: ${filePath} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
            
            try {
              const result = await loadThumbnailWithProgress(filePath, file)
              
              if (mounted && result.data) {
                setImagePreviews(prev => {
                  const m = new Map(prev)
                  m.set(filePath, { thumbnail: result.data, full: '' })
                  return m
                })
                setPreviewVersion(v => v + 1)
                console.log(`[FileList] 预览图片加载成功: ${filePath} (来源: ${result.fromCache ? '缓存' : '网络'})`)
              }
            } catch (error) {
              console.error(`[FileList] 图片缩略图加载失败: ${filePath}`, error)
              
              if (mounted) {
                setImagePreviews(prev => {
                  const m = new Map(prev)
                  m.set(filePath, { thumbnail: '', full: '' }) // 空字符串标记失败
                  return m
                })
              }
            }
          } catch (error) {
            console.error('加载图片缩略图失败:', filePath, error)
            // 对于加载失败的图片，设置错误标记，避免重复尝试
            if (mounted) {
              setImagePreviews(prev => {
                const m = new Map(prev)
                m.set(filePath, { thumbnail: '', full: '' }) // 空字符串标记失败
                return m
              })
            }
          } finally {
            if (mounted) {
              setLoadingImages(prev => {
                const newSet = new Set(prev)
                newSet.delete(filePath)
                return newSet
              })
            }
          }

          // 优化延迟：减少等待时间，提高加载速度
          await new Promise(res => setTimeout(res, 500))
        }
      }

      const workers: Promise<void>[] = []
      for (let w = 0; w < Math.min(CONCURRENCY, sortedImages.length); w++) {
        workers.push(worker())
      }

      try {
        await Promise.allSettled(workers) // 使用 allSettled 避免单个失败影响全部
      } catch (e) {
        console.warn('部分缩略图加载任务失败:', e)
      }
    }

    loadVisibleThumbnails()

    return () => {
      mounted = false
    }
  }, [visibleImages, previewEnabled, imagePreviews, loadingImages, fileList])

  // 判断文件是否可预览
  const isPreviewable = (file: FileInfo): boolean => {
    if (file.isDirectory) return false
    const ext = getFileExtension(file.name).toLowerCase()
    const previewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'mp3', 'wav', 'flac', 'aac']
    return previewableTypes.includes(ext)
  }

  // 将FileInfo转换为Image格式
  const convertFileToImage = async (file: FileInfo, imageUrl: string, loadFullImageForDimensions: boolean = false): Promise<Image> => {
    // 获取图片尺寸 - 优先从 electron 端获取，失败则从前端加载图片获取
    let width = 0
    let height = 0

    // 首先尝试从 electron 端获取尺寸（更准确）
    try {
      const dimensions = await window.electronAPI?.getImageDimensions(file.path)
      if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
        width = dimensions.width
        height = dimensions.height
      } else {
        throw new Error('无法从 electron 端获取尺寸')
      }
    } catch (error) {
      // 如果 electron 端获取失败，尝试从前端加载图片获取
      console.warn('从 electron 端获取图片尺寸失败，尝试从前端获取:', error)
      try {
        const img = new Image()
        // 如果需要获取原图尺寸，优先使用原图 URL（从缓存获取或重新加载）
        const urlToLoad = loadFullImageForDimensions ? (imageUrl || '') : imageUrl
        img.src = urlToLoad
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('加载超时'))
          }, 10000)

          img.onload = () => {
            clearTimeout(timeout)
            width = img.naturalWidth || img.width || 0
            height = img.naturalHeight || img.height || 0
            if (width > 0 && height > 0) {
              resolve()
            } else {
              reject(new Error('无法获取图片尺寸'))
            }
          }

          img.onerror = () => {
            clearTimeout(timeout)
            reject(new Error('图片加载失败'))
          }
        })
      } catch (imgError) {
        console.error('从前端获取图片尺寸也失败:', imgError)
        // 如果都失败了，使用默认值（但应该尽量避免这种情况）
        width = 1920
        height = 1080
      }
    }

    return {
      id: file.path,
      url: imageUrl,
      filename: file.name,
      width,
      height,
      size: file.size,
      format: getFileExtension(file.name).toLowerCase() || 'unknown',
      createdAt: new Date(file.createdTime).toISOString(),
      modifiedAt: new Date(file.modifiedTime).toISOString(),
      description: '',
      tags: []
    }
  }

  // 预览文件
  const handlePreview = async (file: FileInfo) => {
    // 检查文件大小，超过50MB的图片不进行预览
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(getFileExtension(file.name).toLowerCase()) && file.size > MAX_IMAGE_SIZE) {
      message.info('图片大小超过50MB，不支持预览')
      return
    }
    
    // 在应用内弹出模态预览，并支持上一张/下一张
    const files = fileList.filter(f => !f.isDirectory && isPreviewable(f) && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(getFileExtension(f.name).toLowerCase()))
    const index = files.findIndex(f => f.path === file.path)
    if (index >= 0) {
      setPreviewableFiles(files)

      // 构建初始图片列表（使用占位符）
      const initialImages: Image[] = files.map((f) => ({
        id: f.path,
        url: '', // 初始为空，将在组件中异步加载
        filename: f.name,
        width: 0,
        height: 0,
        size: f.size,
        format: getFileExtension(f.name).toLowerCase() || 'unknown',
        createdAt: new Date(f.createdTime).toISOString(),
        modifiedAt: new Date(f.modifiedTime).toISOString(),
        description: '',
        tags: []
      }))

      setPreviewImages(initialImages)
      setPreviewIndex(index)
      
      // 先加载第一张图片，然后再打开查看器
      try {
        // 直接传入 file 对象，避免依赖 previewableFiles 状态
        await loadImageForPreview(index, files[index].path, files[index])
        // 图片加载完成后再打开查看器，确保第一张图片能正确显示
        setPreviewModalVisible(true)
      } catch (error) {
        console.error('[FileList] 加载第一张图片失败:', error)
        // 即使加载失败也打开查看器，让用户看到错误提示
        setPreviewModalVisible(true)
      }
    } else {
      // 回退到系统预览
      if (window.electronAPI && window.electronAPI.previewFile) {
        window.electronAPI.previewFile(file.path)
      }
    }
  }

  // 加载图片数据（优化版本 - 智能缓存和渐进式加载）
  const loadImageForPreview = async (index: number, filePath: string, file?: FileInfo) => {
    try {
      // 优先使用传入的 file 参数，如果没有则从 previewableFiles 获取
      const targetFile = file || previewableFiles[index]
      if (!targetFile) {
        console.warn(`[FileList] 无法找到文件信息: index=${index}, path=${filePath}`)
        return
      }
      
      // 检查文件大小，超过50MB的图片不加载原图
      if (targetFile.size > MAX_IMAGE_SIZE) {
        console.log(`跳过大于50MB的图片加载: ${targetFile.name}`)
        return
      }
      
      // 打开大图时优先加载原图
      const previewData = imagePreviews.get(filePath)
      if (previewData?.full?.trim()) {
        console.log(`[FileList] 使用缓存原图: ${targetFile.name}`)
        const image = await convertFileToImage(targetFile, previewData.full)
        setPreviewImages(prev => {
          const newImages = [...prev]
          newImages[index] = image
          return newImages
        })
        return
      }

      // 没有原图缓存，加载原图
      console.log(`[FileList] 正在智能加载图片: ${targetFile.name}`)
      
      try {
        const result = await imageLoader.loadSmart(filePath, {
          useCache: true,
          timeout: 20000,
          retryCount: 1,
          fallbackSize: 200,
          fallbackQuality: 70
        })
        
        if (result.data) {
          console.log(`[FileList] 加载图片 ${index}: ${targetFile.name} (类型: ${result.isThumbnail ? '缩略图' : '原图'}, 来源: ${result.fromCache ? '缓存' : '网络'}, 大小: ${(result.size / 1024).toFixed(1)}KB)`)
          const image = await convertFileToImage(targetFile, result.data)
          console.log(`[FileList] 图片尺寸: ${image.width}x${image.height}`)
          setPreviewImages(prev => {
            const newImages = [...prev]
            newImages[index] = image
            return newImages
          })
          
          // 更新缓存
          setImagePreviews(prev => {
            const m = new Map(prev)
            const existingData = m.get(filePath)
            if (result.isThumbnail) {
              // 如果是缩略图，只更新 thumbnail，保留 full（原图）
              m.set(filePath, { 
                thumbnail: result.data, 
                full: existingData?.full || '' 
              })
            } else {
              // 如果是原图，同时更新 thumbnail 和 full
              m.set(filePath, { 
                thumbnail: result.data, 
                full: result.data 
              })
            }
            return m
          })
        } else {
          throw new Error('图片数据为空')
        }
      } catch (error) {
        throw new Error(`智能加载失败: ${error}`)
      }
    } catch (e) {
      console.error('[FileList] 加载图片失败:', e)
      
      // 降级策略：尝试生成更小的缩略图
      const targetFile = file || previewableFiles[index]
      if (targetFile && targetFile.size <= MAX_IMAGE_SIZE) {
        try {
          console.log(`[FileList] 尝试生成降级缩略图: ${targetFile.name}`)
          const fallbackResult = await imageLoader.loadThumbnail(filePath, 200, 70, {
            useCache: true,
            timeout: 10000,
            retryCount: 1
          })
          
          if (fallbackResult.data) {
            const image = await convertFileToImage(targetFile, fallbackResult.data)
            setPreviewImages(prev => {
              const newImages = [...prev]
              newImages[index] = image
              return newImages
            })
            
            // 更新缓存（降级加载的是缩略图，不要覆盖 full 字段）
            setImagePreviews(prev => {
              const m = new Map(prev)
              const existingData = m.get(filePath)
              m.set(filePath, {
                thumbnail: fallbackResult.data,
                full: existingData?.full || ''
              })
              return m
            })
          } else {
            throw new Error('降级缩略图生成失败')
          }
        } catch (err) {
          console.error('[FileList] 降级加载也失败:', err)
          // 设置错误状态
          setPreviewImages(prev => {
            const newImages = [...prev]
            newImages[index] = {
              ...newImages[index],
              url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#999" font-size="14">加载失败</text></svg>'
            }
            return newImages
          })
        }
      }
    }
  }

  // 处理图片索引变化（当用户切换图片时）
  const handlePreviewIndexChange = async (newIndex: number) => {
    setPreviewIndex(newIndex)
    if (previewableFiles[newIndex]) {
      // 如果该图片还未加载，则加载它
      const currentImage = previewImages[newIndex]
      if (!currentImage || !currentImage.url || currentImage.url.trim() === '') {
        await loadImageForPreview(newIndex, previewableFiles[newIndex].path, previewableFiles[newIndex])
      }
    }
  }

  // 重命名文件
  const handleRename = (file: FileInfo) => {
    setRenamingFile(file)
    setNewFileName(file.name)
    setRenameModalVisible(true)
  }

  const handleRenameConfirm = async () => {
    if (!renamingFile || !newFileName.trim()) return

    try {
      const success = await window.electronAPI?.renameFile(renamingFile.path, newFileName.trim())
      if (success) {
        message.success('重命名成功')
        // 重新加载目录
        if (currentPath) {
          loadDirectory(currentPath)
        }
      } else {
        message.error('重命名失败')
      }
    } catch (error) {
      message.error('重命名失败')
    }
    setRenameModalVisible(false)
    setRenamingFile(null)
    setNewFileName('')
  }

  const handleRenameCancel = () => {
    setRenameModalVisible(false)
    setRenamingFile(null)
    setNewFileName('')
  }

  // 删除文件
  const handleDelete = (file: FileInfo) => {
    setDeletingFile(file)
    setDeleteModalVisible(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingFile) return

    try {
      const success = await window.electronAPI?.deleteFile(deletingFile.path)
      if (success) {
        message.success('删除成功')
        // 重新加载目录
        if (currentPath) {
          loadDirectory(currentPath)
        }
      } else {
        message.error('删除失败')
      }
    } catch (error) {
      message.error('删除失败')
    }
    setDeleteModalVisible(false)
    setDeletingFile(null)
  }

  const handleDeleteCancel = () => {
    setDeleteModalVisible(false)
    setDeletingFile(null)
  }

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRows.length === 0) {
      message.warning('请先选择要删除的文件')
      return
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRows.length} 个项目吗？此操作不可撤销！`,
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          let successCount = 0
          for (const file of selectedRows) {
            const success = await window.electronAPI?.deleteFile(file.path)
            if (success) successCount++
          }
          message.success(`批量删除完成：成功 ${successCount} 个，失败 ${selectedRows.length - successCount} 个`)
          setSelectedRowKeys([])
          setSelectedRows([])
          if (currentPath) {
            loadDirectory(currentPath)
          }
        } catch (error) {
          message.error('批量删除失败')
        }
      }
    })
  }

  // 批量重命名
  const handleBatchRename = () => {
    if (selectedRows.length === 0) {
      message.warning('请先选择要重命名的文件')
      return
    }
    setBatchRenameModalVisible(true)
  }

  const handleBatchRenameConfirm = async () => {
    if (selectedRows.length === 0) return

    try {
      let successCount = 0
      for (const file of selectedRows) {
        const ext = getFileExtension(file.name)
        const baseName = file.name.replace('.' + ext, '')
        const newBaseName = batchRenamePrefix + baseName + batchRenameSuffix
        const newName = ext ? newBaseName + '.' + ext : newBaseName
        const success = await window.electronAPI?.renameFile(file.path, newName)
        if (success) successCount++
      }
      message.success(`批量重命名完成：成功 ${successCount} 个，失败 ${selectedRows.length - successCount} 个`)
      setBatchRenameModalVisible(false)
      setBatchRenamePrefix('')
      setBatchRenameSuffix('')
      setSelectedRowKeys([])
      setSelectedRows([])
      if (currentPath) {
        loadDirectory(currentPath)
      }
    } catch (error) {
      message.error('批量重命名失败')
    }
  }

  const handleBatchRenameCancel = () => {
    setBatchRenameModalVisible(false)
    setBatchRenamePrefix('')
    setBatchRenameSuffix('')
  }

  // 批量移动
  const handleBatchMove = () => {
    if (selectedRows.length === 0) {
      message.warning('请先选择要移动的文件')
      return
    }
    setMoveModalVisible(true)
    setMoveTargetPath('')
  }

  const handleBatchMoveConfirm = async () => {
    if (selectedRows.length === 0 || !moveTargetPath.trim()) return

    try {
      const targetDir = currentPath + '/' + moveTargetPath.trim()
      let successCount = 0
      for (const file of selectedRows) {
        const newPath = targetDir + '/' + file.name
        const success = await window.electronAPI?.moveFile(file.path, newPath)
        if (success) successCount++
      }
      message.success(`批量移动完成：成功 ${successCount} 个，失败 ${selectedRows.length - successCount} 个`)
      setMoveModalVisible(false)
      setMoveTargetPath('')
      setSelectedRowKeys([])
      setSelectedRows([])
      if (currentPath) {
        loadDirectory(currentPath)
      }
    } catch (error) {
      message.error('批量移动失败')
    }
  }

  const handleBatchMoveCancel = () => {
    setMoveModalVisible(false)
    setMoveTargetPath('')
  }

  // 获取子文件夹选项用于autocomplete
  const getSubfolderOptions = () => {
    return fileList
      .filter(f => f.isDirectory)
      .map(f => ({ value: f.name }))
  }

  // 获取文件图标
  const getIcon = (file: FileInfo) => {
    if (file.isDirectory) {
      return <FolderOutlined style={{ color: '#1890ff' }} />
    }

    const ext = getFileExtension(file.name)
    const iconType = getFileTypeIcon(ext, false)

    const iconMap: Record<string, React.ReactNode> = {
      'image': <PictureOutlined style={{ color: '#52c41a' }} />,
      'file-pdf': <FilePdfOutlined style={{ color: '#ff4d4f' }} />,
      'file-word': <FileWordOutlined style={{ color: '#1890ff' }} />,
      'file-excel': <FileExcelOutlined style={{ color: '#52c41a' }} />,
      'video': <VideoCameraOutlined style={{ color: '#faad14' }} />,
      'audio': <SoundOutlined style={{ color: '#722ed1' }} />,
      'file-zip': <FileZipOutlined style={{ color: '#fa8c16' }} />
    }

    return iconMap[iconType] || <FileOutlined />
  }

  // 双击处理函数
  const handleDoubleClick = async (file: FileInfo) => {
    try {
      if (file.isDirectory) {
        // 如果是文件夹，切换到该文件夹，但不记录到历史
        loadDirectory(file.path, false)
      } else {
        // 如果是媒体文件，调用系统默认打开程序
        if (isPreviewable(file)) {
          if (window.electronAPI && window.electronAPI.openFile) {
            await window.electronAPI.openFile(file.path)
          } else {
            message.error('无法打开文件：系统API不可用')
          }
        } else {
          // 非媒体文件也尝试打开
          if (window.electronAPI && window.electronAPI.openFile) {
            await window.electronAPI.openFile(file.path)
          } else {
            message.error('无法打开文件：系统API不可用')
          }
        }
      }
    } catch (error) {
      console.error('双击操作失败:', error)
      message.error('操作失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const columns: ColumnsType<FileInfo> = [
    ...(previewEnabled ? [{
      title: '预览',
      key: 'preview',
      width: '10%',
      render: (_: any, record: FileInfo) => {
        if (isPreviewable(record)) {
          const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(getFileExtension(record.name).toLowerCase())
          // 只有超过50MB的图片才显示占位符，小于等于50MB的都应该尝试显示预览
          const isLargeImage = isImage && record.size > MAX_IMAGE_SIZE
          const previewData = imagePreviews.get(record.path)
          const isLoading = loadingImages.has(record.path)
          const progress = imageProgress.get(record.path)

          return (
            <div
              ref={(el) => {
                if (el) {
                  el.dataset.filePath = record.path
                  imageRefs.current.set(record.path, el)
                  // 如果 observer 已存在，立即观察；否则等待 observer 创建后再观察
                  if (observerRef.current) {
                    observerRef.current.observe(el)
                  } else {
                    // 延迟观察，确保 observer 已创建
                    setTimeout(() => {
                      if (observerRef.current && imageRefs.current.has(record.path)) {
                        const element = imageRefs.current.get(record.path)
                        if (element) {
                          observerRef.current.observe(element)
                        }
                      }
                    }, 100)
                  }
                } else {
                  // 元素被卸载时，清理引用
                  imageRefs.current.delete(record.path)
                  if (observerRef.current) {
                    const element = imageRefs.current.get(record.path)
                    if (element) {
                      observerRef.current.unobserve(element)
                    }
                  }
                }
              }}
              style={{ width: 50, height: 50, borderRadius: 4, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
              onClick={() => handlePreview(record)}
            >
              {isLargeImage ? (
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#999',
                  textAlign: 'center',
                  padding: '4px'
                }}>
                  <div>大图片</div>
                  <div style={{ fontSize: '10px' }}>超过50MB</div>
                </div>
              ) : previewData && (previewData.thumbnail || previewData.full) ? (
                <div
                  key={`preview-${record.path}-${previewVersion}`}
                  ref={(el) => {
                    if (el && previewData) {
                      el.innerHTML = `<img src="${previewData.thumbnail || previewData.full}" style="width:100%;height:100%;object-fit:cover;" alt="preview" />`
                    }
                  }}
                />
              ) : isLoading && progress !== undefined ? (
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CircularProgress
                    progress={progress}
                    size={40}
                    strokeWidth={3}
                    color="#1890ff"
                    backgroundColor="#e8e8e8"
                    showText={true}
                  />
                </div>
              ) : isLoading ? (
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <PictureOutlined style={{ color: '#ccc' }} />
                </div>
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <PictureOutlined style={{ color: '#ccc' }} />
                </div>
              )}
            </div>
          )
        }
        return null
      }
    }] : []),
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: previewEnabled ? '25%' : '30%',
      render: (text: string, record: FileInfo) => (
        <Space>
          {getIcon(record)}
          <span style={{ width: '5em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
          {record.isDirectory && <Tag color="blue">文件夹</Tag>}
        </Space>
      )
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: previewEnabled ? '15%' : '20%',
      render: (size: number, record: FileInfo) =>
        record.isDirectory ? '-' : formatFileSize(size)
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedTime',
      key: 'modifiedTime',
      width: previewEnabled ? '25%' : '30%',
      render: (time: number) => formatDateTime(time)
    },
    {
      title: '操作',
      key: 'action',
      width: previewEnabled ? '20%' : '20%',
      render: (_, record: FileInfo) => (
        <Space>
          <span
            style={{ color: '#1890ff', cursor: 'pointer' }}
            onClick={() => handlePreview(record)}
            title={isPreviewable(record) ? '预览文件' : '此文件类型不支持预览'}
          >
            查看
          </span>
          <span
            style={{ color: '#1890ff', cursor: 'pointer' }}
            onClick={() => handleRename(record)}
            title="重命名"
          >
            重命名
          </span>
          <span
            style={{ color: 'red', cursor: 'pointer' }}
            onClick={() => handleDelete(record)}
            title="删除"
          >
            删除
          </span>
        </Space>
      )
    }
  ]

  // 返回上级目录
  const handleGoBack = () => {
    if (!currentPath) return
    // 计算上级目录路径
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/' // 处理根目录情况
    loadDirectory(parentPath)
  }

  // 分页逻辑
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize

  // 应用文件筛选
  const filteredFileList = useMemo(() => {
    return filterFiles(fileList, selectedCategory, selectedSubExtensions)
  }, [fileList, selectedCategory, selectedSubExtensions])

  const paginatedFileList = filteredFileList.slice(startIndex, endIndex)
  const total = filteredFileList.length

  // 当文件列表或每页显示数量变化时，重置当前页码为1
  useEffect(() => {
    setCurrentPage(1)
  }, [fileList, pageSize, selectedCategory, selectedSubExtensions])

  // 响应式网格列数计算
  const [gridColumns, setGridColumns] = useState(5)

  useEffect(() => {
    const calculateGridColumns = () => {
      const width = window.innerWidth
      if (width < 768) return 2
      if (width < 1024) return 3
      if (width < 1440) return 4
      return 5
    }

    const updateGridColumns = () => {
      setGridColumns(calculateGridColumns())
    }

    // 初始化
    updateGridColumns()
    // 监听窗口大小变化
    window.addEventListener('resize', updateGridColumns)
    // 清理
    return () => window.removeEventListener('resize', updateGridColumns)
  }, [])

  if (!currentPath) {
    return (
      <Card title="文件列表" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Empty description="请先选择目录" />
      </Card>
    )
  }

  // 获取当前选中分类的二级选项
  const currentCategoryInfo = FILE_CATEGORIES.find(c => c.key === selectedCategory)
  const subExtensions = currentCategoryInfo?.extensions || []

  // 处理一级分类变更
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value as 'all' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other')
  }

  // 处理二级分类变更
  const handleSubExtensionChange = (value: string[]) => {
    setSelectedSubExtensions(value)
  }

  // 重置筛选
  const handleResetFilter = () => {
    resetFilter()
  }

  const isCurrentPathInHistory = currentPath ? historyList.some(item => item.path === currentPath) : false

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Space size="small">
            {!isCurrentPathInHistory && (
              <Button
                type="default"
                size="small"
                icon={<LeftOutlined />}
                onClick={handleGoBack}
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
            {/* 文件筛选器 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16, padding: '4px 8px', backgroundColor: '#f5f5f5', borderRadius: 6 }}>
              <FilterOutlined style={{ color: '#666' }} />
              <Select
                value={selectedCategory}
                onChange={handleCategoryChange}
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
                    onChange={handleSubExtensionChange}
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
                  onClick={handleResetFilter}
                  title="清除筛选"
                />
              )}
            </div>
            {selectedCategory !== 'all' && (
              <span style={{ fontSize: 12, color: '#999' }}>
                ({filteredFileList.length} 项)
              </span>
            )}
          </Space>
          <Space size="middle">
            <Switch
              checkedChildren="网格"
              unCheckedChildren="列表"
              checked={viewMode === 'grid'}
              onChange={(checked: boolean) => setViewMode(checked ? 'grid' : 'list')}
              title={viewMode === 'list' ? '切换到网格视图' : '切换到列表视图'}
            />
            {/* <Button
              type={viewMode === 'list' ? 'primary' : 'default'}
              size="small"
              onClick={() => setViewMode('list')}
              style={{ transition: 'all 0.3s ease' }}
            >
              列表视图
            </Button>
            <Button
              type={viewMode === 'grid' ? 'primary' : 'default'}
              size="small"
              onClick={() => setViewMode('grid')}
              style={{ transition: 'all 0.3s ease' }}
            >
              网格视图
            </Button> */}
          </Space>
        </div>
      }
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ padding: 0 }}
    >
      {selectedRows.length > 0 && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0', backgroundColor: '#fafafa' }}>
          <Space>
            <span>已选择 {selectedRows.length} 项</span>
            <AntButton size="small" danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
              批量删除
            </AntButton>
            <AntButton size="small" icon={<EditOutlined />} onClick={handleBatchRename}>
              批量重命名
            </AntButton>
            <AntButton size="small" icon={<FolderOpenOutlined />} onClick={handleBatchMove}>
              批量移动
            </AntButton>
            <AntButton size="small" onClick={() => { setSelectedRowKeys([]); setSelectedRows([]) }}>
              取消选择
            </AntButton>
          </Space>
        </div>
      )}
      {viewMode === 'list' ? (
        <Table
          columns={columns}
          dataSource={paginatedFileList}
          loading={loading}
          rowKey="path"
          rowSelection={{
            selectedRowKeys,
            onChange: (keys, rows) => {
              setSelectedRowKeys(keys as string[])
              setSelectedRows(rows)
            }
          }}
          scroll={{ x: true, y: selectedRows.length > 0 ? 'calc(100vh - 260px)' : 'calc(100vh - 275px)' }}
          onRow={(record) => ({
            onDoubleClick: () => handleDoubleClick(record),
            style: { cursor: record.isDirectory ? 'pointer' : 'default', height: '40px' }
          })}
          pagination={false}
          locale={{ emptyText: <Empty description="该目录暂无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          style={{
            transition: 'all 0.3s ease-in-out',
            opacity: 1,
            transform: 'translateX(0)',
            animation: 'fadeIn 0.3s ease-in-out'
          }}
        />
      ) : paginatedFileList.length === 0 ? (
        <div style={{ width: '100%', height: 'calc(100vh - 220px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="该目录暂无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
            gap: '10px',
            padding: '10px',
            overflowY: 'auto',
            maxHeight: selectedRows.length > 0 ? 'calc(100vh - 260px)' : 'calc(100vh - 220px)',
            transition: 'all 0.3s ease-in-out',
            opacity: 1,
            transform: 'translateX(0)',
            animation: 'fadeIn 0.3s ease-in-out'
          }}
        >
          {paginatedFileList.map(file => (
            <div
              key={file.path}
              style={{
                border: `1px solid ${selectedRowKeys.includes(file.path) ? '#1890ff' : '#d9d9d9'}`,
                borderRadius: '5px',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                cursor: file.isDirectory ? 'pointer' : 'default',
                position: 'relative',
                backgroundColor: selectedRowKeys.includes(file.path) ? '#e6f7ff' : '#fff',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                transform: 'scale(1)',
                opacity: 1
              }}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest('.ant-checkbox-wrapper') &&
                  !(e.target as HTMLElement).closest('[data-preview-area]')) {
                  if (!file.isDirectory && isPreviewable(file)) {
                    handlePreview(file)
                  }
                }
              }}
              onDoubleClick={() => handleDoubleClick(file)}
              onMouseEnter={(e) => {
                const target = e.currentTarget as HTMLElement
                target.style.transform = 'scale(1.02)'
                target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget as HTMLElement
                target.style.transform = 'scale(1)'
                target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}
            >
              {/* 复选框 */}
              <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10, backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
                <Checkbox
                  checked={selectedRowKeys.includes(file.path)}
                  onChange={(e) => {
                    const newSelectedRowKeys = e.target.checked
                      ? [...selectedRowKeys, file.path]
                      : selectedRowKeys.filter(key => key !== file.path)
                    const newSelectedRows = e.target.checked
                      ? [...selectedRows, file]
                      : selectedRows.filter(row => row.path !== file.path)
                    setSelectedRowKeys(newSelectedRowKeys)
                    setSelectedRows(newSelectedRows)
                  }}
                />
              </div>
              {/* 图片预览区域 */}
              <div
                ref={(el) => {
                  if (el) {
                    el.dataset.filePath = file.path
                    imageRefs.current.set(file.path, el)
                    // 如果 observer 已存在，立即观察；否则等待 observer 创建后再观察
                    if (observerRef.current) {
                      observerRef.current.observe(el)
                    } else {
                      // 延迟观察，确保 observer 已创建
                      setTimeout(() => {
                        if (observerRef.current && imageRefs.current.has(file.path)) {
                          const element = imageRefs.current.get(file.path)
                          if (element) {
                            observerRef.current.observe(element)
                          }
                        }
                      }, 100)
                    }
                  } else {
                    // 元素被卸载时，清理引用
                    imageRefs.current.delete(file.path)
                    if (observerRef.current) {
                      const element = imageRefs.current.get(file.path)
                      if (element) {
                        observerRef.current.unobserve(element)
                      }
                    }
                  }
                }}
                data-preview-area="true"
                onClick={(e) => {
                  e.stopPropagation() // 阻止事件冒泡到外层div
                  if (!file.isDirectory && isPreviewable(file)) {
                    handlePreview(file)
                  }
                }}
                style={{
                  width: '100%',
                  height: '120px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5',
                  cursor: !file.isDirectory && isPreviewable(file) ? 'pointer' : 'default',
                  position: 'relative'
                }}
                title={!file.isDirectory && isPreviewable(file) ? '点击预览图片' : ''}
              >
                {isPreviewable(file) ? (
                  <>
                    {(() => {
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(getFileExtension(file.name).toLowerCase())
                      // 只有超过50MB的图片才显示占位符，小于等于50MB的都应该尝试显示预览
                      const isLargeImage = isImage && file.size > MAX_IMAGE_SIZE
                      const previewData = imagePreviews.get(file.path)
                      const isLoading = loadingImages.has(file.path)
                      const progress = imageProgress.get(file.path)

                      if (isLargeImage) {
                        return (
                          <div style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#f0f0f0',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            color: '#999',
                            textAlign: 'center',
                            padding: '8px'
                          }}>
                            <PictureOutlined style={{ fontSize: '32px', color: '#ccc', marginBottom: '8px' }} />
                            <div>大图片</div>
                            <div style={{ fontSize: '12px' }}>超过50MB</div>
                          </div>
                        )
                      }

                      // 优先显示已加载的图片（即使还在loading状态）
                      if (previewData && (previewData.thumbnail || previewData.full)) {
                        return (
                          <div
                            key={`preview-${file.path}-${previewVersion}`}
                            ref={(el) => {
                              if (el && previewData) {
                                el.innerHTML = `<img src="${previewData.thumbnail || previewData.full}" style="width:100%;height:100%;object-fit:cover;" alt="${file.name}" />`
                              }
                            }}
                          />
                        )
                      }

                      // 如果正在加载且有进度，显示进度条
                      if (isLoading && progress !== undefined) {
                        return (
                          <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5',
                            position: 'relative'
                          }}>
                            <CircularProgress
                              progress={progress}
                              size={50}
                              strokeWidth={4}
                              color="#1890ff"
                              backgroundColor="#e8e8e8"
                              showText={true}
                            />
                          </div>
                        )
                      }

                      // 如果正在加载但没有进度，显示加载图标
                      if (isLoading) {
                        return (
                          <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5'
                          }}>
                            <PictureOutlined style={{ fontSize: '32px', color: '#ccc' }} />
                          </div>
                        )
                      }

                      return (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f5f5f5'
                        }}>
                          <PictureOutlined style={{ fontSize: '32px', color: '#ccc' }} />
                        </div>
                      )
                    })()}
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    {getIcon(file)}
                  </div>
                )}
              </div>

              {/* 信息展示区域 */}
              <div style={{ padding: '8px', backgroundColor: '#fff' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  {file.isDirectory ? '-' : formatFileSize(file.size)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页组件 - 适用于列表和网格视图 */}
      {total > 0 && (
        <div style={{ padding: '16px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ marginRight: '16px', fontSize: '14px' }}>共 {total} 条记录</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px' }}>每页显示：</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newPageSize = parseInt(e.target.value, 10)
                setPageSize(newPageSize)
                setCurrentPage(1)
              }}
              style={{
                padding: '4px 8px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              {pageSizeOptions.map(option => (
                <option key={option} value={parseInt(option, 10)}>{option}</option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button
                type="default"
                size="small"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                上一页
              </Button>
              <span style={{ fontSize: '14px', minWidth: '60px', textAlign: 'center' }}>
                {currentPage} / {Math.ceil(total / pageSize)}
              </span>
              <Button
                type="default"
                size="small"
                disabled={currentPage === Math.ceil(total / pageSize)}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* 图片查看器组件 */}
      {previewModalVisible && (
        <ImageViewer
          images={previewImages}
          currentIndex={previewIndex}
          onClose={() => {
            setPreviewModalVisible(false)
            setPreviewImages([])
            setPreviewableFiles([])
          }}
          onIndexChange={handlePreviewIndexChange}
          onImageDelete={async (imageId) => {
            const file = previewableFiles.find(f => f.path === imageId)
            if (file) {
              const success = await window.electronAPI?.deleteFile(file.path)
              if (success) {
                message.success('删除成功')
                // 重新加载目录
                if (currentPath) {
                  loadDirectory(currentPath)
                }
                // 关闭查看器
                setPreviewModalVisible(false)
                setPreviewImages([])
                setPreviewableFiles([])
              } else {
                message.error('删除失败')
              }
            }
          }}
        />
      )}
      <Modal
        title="重命名文件"
        open={renameModalVisible}
        onOk={handleRenameConfirm}
        onCancel={handleRenameCancel}
        okText="确定"
        cancelText="取消"
      >
        <Input
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          placeholder="请输入新文件名"
          onPressEnter={handleRenameConfirm}
        />
      </Modal>
      <Modal
        title="确认删除"
        open={deleteModalVisible}
        onOk={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        okText="确定删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除 "{deletingFile?.name}" 吗？</p>
        <p style={{ color: '#ff4d4f' }}>此操作不可撤销！</p>
      </Modal>
      <Modal
        title="批量重命名"
        open={batchRenameModalVisible}
        onOk={handleBatchRenameConfirm}
        onCancel={handleBatchRenameCancel}
        okText="确定"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <label>前缀：</label>
            <Input
              value={batchRenamePrefix}
              onChange={(e) => setBatchRenamePrefix(e.target.value)}
              placeholder="输入前缀"
            />
          </div>
          <div>
            <label>后缀：</label>
            <Input
              value={batchRenameSuffix}
              onChange={(e) => setBatchRenameSuffix(e.target.value)}
              placeholder="输入后缀"
            />
          </div>
        </Space>
      </Modal>
      <Modal
        title="批量移动"
        open={moveModalVisible}
        onOk={handleBatchMoveConfirm}
        onCancel={handleBatchMoveCancel}
        okText="确定"
        cancelText="取消"
      >
        <div>
          <label>目标文件夹：</label>
          <AutoComplete
            value={moveTargetPath}
            onChange={setMoveTargetPath}
            options={getSubfolderOptions()}
            placeholder="输入或选择子文件夹名称"
            style={{ width: '100%' }}
          />
        </div>
      </Modal>
    </Card>
  )
}

export default FileList

