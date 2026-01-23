import React, { useState, useEffect, useRef } from 'react'
import { Table, Card, Tag, Space, Empty, Modal, Input, message, Button, Switch, AutoComplete, Checkbox } from 'antd'
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
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { useFileStore } from '../stores/fileStore'
import { useFileSystem } from '../hooks/useFileSystem'
import { formatFileSize, formatDateTime, getFileExtension, getFileTypeIcon } from '../utils/fileUtils'
import type { FileInfo } from '../types'

const FileList: React.FC = () => {
  const { fileList, loading, currentPath } = useFileStore()
  const { loadDirectory } = useFileSystem()
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renamingFile, setRenamingFile] = useState<FileInfo | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deletingFile, setDeletingFile] = useState<FileInfo | null>(null)
  const [imagePreviews, setImagePreviews] = useState<Map<string, { thumbnail: string; full: string }>>(new Map())
  const [visibleImages, setVisibleImages] = useState<Set<string>>(new Set())
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)
  const imageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number>(0)
  const [currentImageBase64, setCurrentImageBase64] = useState<string | null>(null)
  const [isLoadingHighRes, setIsLoadingHighRes] = useState(false)
  const [imageLoadError, setImageLoadError] = useState(false)
  const [previewEnabled] = useState(true) // 预览开关，默认打开
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [selectedRows, setSelectedRows] = useState<FileInfo[]>([])
  const [batchRenameModalVisible, setBatchRenameModalVisible] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list') // 视图模式：列表视图/网格视图
  const [batchRenamePrefix, setBatchRenamePrefix] = useState('')
  const [batchRenameSuffix, setBatchRenameSuffix] = useState('')
  const [moveModalVisible, setMoveModalVisible] = useState(false)
  const [moveTargetPath, setMoveTargetPath] = useState('')
  // 图片预览操作状态
  const [scale, setScale] = useState(100) // 当前缩放比例，默认100%
  const [rotation, setRotation] = useState(0) // 当前旋转角度，默认0度
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [pageSizeOptions] = useState(['15', '30', '75', '150', '300']) // 页码选择范围

  // 当目录切换时，清空图片预览缓存
  useEffect(() => {
    setImagePreviews(new Map())
    setVisibleImages(new Set())
    setLoadingImages(new Set())
    // 清理之前的观察
    if (observerRef.current) {
      imageRefs.current.forEach((element) => {
        observerRef.current?.unobserve(element)
      })
    }
    imageRefs.current.clear()
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

  // 加载图片预览（懒加载版本）
  useEffect(() => {
    if (!previewEnabled) {
      setImagePreviews(new Map())
      setVisibleImages(new Set())
      setLoadingImages(new Set())
      return
    }

    // 初始化Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const filePath = (entry.target as HTMLElement).dataset.filePath
          if (!filePath) return

          if (entry.isIntersecting) {
            // 图片进入视口，开始加载
            setVisibleImages(prev => new Set([...prev, filePath]))
          } else {
            // 图片离开视口，可以选择卸载以节省内存
            // setVisibleImages(prev => {
            //   const newSet = new Set(prev)
            //   newSet.delete(filePath)
            //   return newSet
            // })
          }
        })
      },
      {
        rootMargin: '50px', // 提前50px开始加载
        threshold: 0.1
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

    // 延迟观察已存在的元素，确保DOM已渲染
    // 使用 requestAnimationFrame 确保在下一帧执行
    requestAnimationFrame(() => {
      setTimeout(() => {
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
      }, 100)
    })

    return () => {
      observer.disconnect()
    }
  }, [previewEnabled])

  // 加载可见图片的缩略图
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

      // 并发度限制
      const CONCURRENCY = 3
      let index = 0

      const worker = async () => {
        while (true) {
          const i = index
          index += 1
          if (i >= imagesToLoad.length) break
          const filePath = imagesToLoad[i]

          try {
            // 先加载低质量的模糊占位符
            const lowQuality = await window.electronAPI?.getImageThumbnail(filePath, 20, 20)
            if (lowQuality && lowQuality.trim() !== '' && mounted) {
              setImagePreviews(prev => {
                const m = new Map(prev)
                m.set(filePath, { thumbnail: '', full: lowQuality })
                return m
              })
            }

            // 然后加载高质量缩略图
            const highQuality = await window.electronAPI?.getImageThumbnail(filePath, 100, 80)
            if (highQuality && highQuality.trim() !== '' && mounted) {
              setImagePreviews(prev => {
                const m = new Map(prev)
                const current = m.get(filePath) || { thumbnail: '', full: '' }
                m.set(filePath, { ...current, thumbnail: highQuality })
                return m
              })
            }
          } catch (error) {
            console.error('加载图片缩略图失败:', filePath, error)
            // 加载失败时，从 loadingImages 中移除，但不设置预览数据
          } finally {
            if (mounted) {
              setLoadingImages(prev => {
                const newSet = new Set(prev)
                newSet.delete(filePath)
                return newSet
              })
            }
          }

          // 小延迟，给渲染线程喘息
          await new Promise(res => setTimeout(res, 20))
        }
      }

      const workers: Promise<void>[] = []
      for (let w = 0; w < Math.min(CONCURRENCY, imagesToLoad.length); w++) {
        workers.push(worker())
      }

      try {
        await Promise.all(workers)
      } catch (e) {
        // 忽略个别 worker 错误
      }
    }

    loadVisibleThumbnails()

    return () => {
      mounted = false
    }
  }, [visibleImages, previewEnabled, imagePreviews, loadingImages])

  // 判断文件是否可预览
  const isPreviewable = (file: FileInfo): boolean => {
    if (file.isDirectory) return false
    const ext = getFileExtension(file.name).toLowerCase()
    const previewableTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'mp3', 'wav', 'flac', 'aac']
    return previewableTypes.includes(ext)
  }

  // 预览文件
  const handlePreview = async (file: FileInfo) => {
    // 在应用内弹出模态预览，并支持上一张/下一张
    const previewableFiles = fileList.filter(f => !f.isDirectory && isPreviewable(f) && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(getFileExtension(f.name).toLowerCase()))
    const index = previewableFiles.findIndex(f => f.path === file.path)
    if (index >= 0) {
      setPreviewIndex(index)
      setPreviewModalVisible(true)

      // 重置状态
      setImageLoadError(false)

      // 先尝试获取缩略图作为占位符
      const previewData = imagePreviews.get(previewableFiles[index].path)
      if (previewData?.thumbnail) {
        setCurrentImageBase64(previewData.thumbnail)
      } else {
        setCurrentImageBase64(null)
      }

      // 加载高清图片
      setIsLoadingHighRes(true)
      try {
        const highResB64 = await window.electronAPI?.getImageBase64(previewableFiles[index].path)
        if (highResB64) {
          setCurrentImageBase64(highResB64)
        } else {
          setImageLoadError(true)
        }
      } catch (e) {
        console.error('加载高清图片失败:', e)
        setImageLoadError(true)
      } finally {
        setIsLoadingHighRes(false)
      }
    } else {
      // 回退到系统预览
      if (window.electronAPI && window.electronAPI.previewFile) {
        window.electronAPI.previewFile(file.path)
      }
    }
  }

  // 获取当前预览文件列表（路径数组）
  const getPreviewablePaths = () => {
    return fileList
      .filter(f => !f.isDirectory && isPreviewable(f) && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(getFileExtension(f.name).toLowerCase()))
      .map(f => f.path)
  }

  const showPreviewAt = async (index: number) => {
    const paths = getPreviewablePaths()
    if (index < 0 || index >= paths.length) return
    setPreviewIndex(index)
    const path = paths[index]

    // 重置状态
    setImageLoadError(false)

    // 先尝试获取缩略图作为占位符
    const previewData = imagePreviews.get(path)
    if (previewData?.thumbnail) {
      setCurrentImageBase64(previewData.thumbnail)
    } else {
      // 没有缩略图时显示加载状态
      setCurrentImageBase64(null)
    }

    // 加载高清图片
    setIsLoadingHighRes(true)
    try {
      const highResB64 = await window.electronAPI?.getImageBase64(path)
      if (highResB64) {
        setCurrentImageBase64(highResB64)
      } else {
        setImageLoadError(true)
      }
    } catch (e) {
      console.error('加载高清图片失败:', e)
      setImageLoadError(true)
    } finally {
      setIsLoadingHighRes(false)
    }
  }

  const handlePrev = () => {
    if (previewIndex > 0) {
      showPreviewAt(previewIndex - 1)
    }
  }

  const handleNext = () => {
    const paths = getPreviewablePaths()
    if (previewIndex < paths.length - 1) {
      showPreviewAt(previewIndex + 1)
    }
  }

  // 图片缩放功能
  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 20, 300)) // 每次增加20%，上限300%
  }

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 20, 20)) // 每次减少20%，下限20%
  }

  const handleResetScale = () => {
    setScale(100) // 重置缩放为100%
  }

  // 图片旋转功能
  const handleRotateLeft = () => {
    setRotation(prevRotation => prevRotation - 90) // 向左旋转90度
  }

  const handleRotateRight = () => {
    setRotation(prevRotation => prevRotation + 90) // 向右旋转90度
  }

  const handleResetRotation = () => {
    setRotation(0) // 重置旋转为0度
  }

  // 重置所有图片操作状态
  const handleResetAll = () => {
    setScale(100) // 重置缩放为100%
    setRotation(0) // 重置旋转为0度
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!previewModalVisible) return

      // 导航快捷键
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()

      // 缩放和旋转快捷键
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '+':
          case '=':
            e.preventDefault()
            handleZoomIn()
            break
          case '-':
          case '_':
            e.preventDefault()
            handleZoomOut()
            break
          case 'ArrowLeft':
            e.preventDefault()
            handleRotateLeft()
            break
          case 'ArrowRight':
            e.preventDefault()
            handleRotateRight()
            break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewModalVisible, previewIndex, imagePreviews, fileList, scale, rotation])

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
          const previewData = imagePreviews.get(record.path)
          const isLoading = loadingImages.has(record.path)

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
              {isLoading ? (
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
              ) : previewData && (previewData.thumbnail || previewData.full) ? (
                <img
                  src={previewData.thumbnail || previewData.full}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    filter: previewData.thumbnail ? 'none' : 'blur(2px)', // 模糊占位符
                    transition: 'filter 0.3s ease'
                  }}
                  alt="preview"
                  onError={(e) => {
                    // 图片加载失败时，隐藏图片，显示占位符
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent && !parent.querySelector('.error-placeholder')) {
                      const placeholder = document.createElement('div')
                      placeholder.className = 'error-placeholder'
                      placeholder.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;'
                      placeholder.innerHTML = '<span style="font-size: 20px; color: #ccc;">📷</span>'
                      parent.appendChild(placeholder)
                    }
                  }}
                />
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
          <span>{text}</span>
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
  const paginatedFileList = fileList.slice(startIndex, endIndex)
  const total = fileList.length

  // 当文件列表或每页显示数量变化时，重置当前页码为1
  useEffect(() => {
    setCurrentPage(1)
  }, [fileList, pageSize])

  if (!currentPath) {
    return (
      <Card title="文件列表" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Empty description="请先选择目录" />
      </Card>
    )
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Space>
            <Button
              type="default"
              size="small"
              icon={<LeftOutlined />}
              onClick={handleGoBack}
              disabled={!currentPath || currentPath === '/'} // 根目录时禁用
              title="返回上级目录"
            >
              返回
            </Button>
            <span style={{ fontSize: '14px', color: '#666' }}>
              当前路径: {currentPath}
            </span>
          </Space>
          <Space size="middle">
            <Switch
              checkedChildren="网格"
              unCheckedChildren="列表"
              checked={viewMode === 'grid'}
              onChange={(checked) => setViewMode(checked ? 'grid' : 'list')}
              title={viewMode === 'list' ? '切换到网格视图' : '切换到列表视图'}
            />
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
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '10px',
            padding: '10px',
            overflowY: 'auto',
            maxHeight: selectedRows.length > 0 ? 'calc(100vh - 260px)' : 'calc(100vh - 220px)'
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
                backgroundColor: selectedRowKeys.includes(file.path) ? '#e6f7ff' : '#fff'
              }}
              onClick={(e) => {
                // 防止点击复选框时触发预览
                // 防止点击预览区域时重复触发（预览区域有自己的点击事件）
                if (!(e.target as HTMLElement).closest('.ant-checkbox-wrapper') && 
                    !(e.target as HTMLElement).closest('[data-preview-area]')) {
                  // 只有非文件夹且可预览的文件才执行预览操作
                  if (!file.isDirectory && isPreviewable(file)) {
                    handlePreview(file)
                  }
                }
              }}
              onDoubleClick={() => handleDoubleClick(file)}
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
                      const previewData = imagePreviews.get(file.path)
                      const isLoading = loadingImages.has(file.path)

                      if (isLoading) {
                        return <PictureOutlined style={{ fontSize: '32px', color: '#ccc' }} />
                      }

                      if (previewData && (previewData.thumbnail || previewData.full)) {
                        return (
                          <img
                            src={previewData.thumbnail || previewData.full}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              filter: previewData.thumbnail ? 'none' : 'blur(2px)',
                              transition: 'filter 0.3s ease'
                            }}
                            alt={file.name}
                            onError={(e) => {
                              // 图片加载失败时，隐藏图片，显示占位符
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const parent = target.parentElement
                              if (parent) {
                                const placeholder = document.createElement('div')
                                placeholder.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;'
                                placeholder.innerHTML = '<span style="font-size: 32px; color: #ccc;">📷</span>'
                                parent.appendChild(placeholder)
                              }
                            }}
                          />
                        )
                      }

                      return <PictureOutlined style={{ fontSize: '32px', color: '#ccc' }} />
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
      <Modal
        title={
          <Space>
            图片预览
            <span style={{ fontSize: 12, color: '#999' }}>{getPreviewablePaths()[previewIndex]?.split('/').pop()}</span>
          </Space>
        }
        open={previewModalVisible}
        onCancel={() => { 
          setPreviewModalVisible(false)
          setCurrentImageBase64(null)
          handleResetAll() // 关闭时重置所有状态
        }}
        footer={[
          <Space key="zoom-controls">
            <Button key="zoom-out" icon={<ZoomOutOutlined />} onClick={handleZoomOut} disabled={scale <= 20} title="缩小" />,
            <Button key="zoom-in" icon={<ZoomInOutlined />} onClick={handleZoomIn} disabled={scale >= 300} title="放大" />,
            <Button key="reset-scale" onClick={handleResetScale} title="重置缩放">重置缩放</Button>
          </Space>,
          <Space key="rotate-controls">
            <Button key="rotate-left" icon={<RotateLeftOutlined />} onClick={handleRotateLeft} title="向左旋转" />,
            <Button key="rotate-right" icon={<RotateRightOutlined />} onClick={handleRotateRight} title="向右旋转" />,
            <Button key="reset-rotation" onClick={handleResetRotation} title="重置旋转">重置旋转</Button>
          </Space>,
          <Button key="reset-all" icon={<ReloadOutlined />} onClick={handleResetAll} title="重置所有">重置所有</Button>,
          <Space key="nav-controls" style={{ marginLeft: 'auto' }}>
            <Button key="prev" icon={<LeftOutlined />} onClick={handlePrev} disabled={previewIndex <= 0} title="上一张" />,
            <Button key="next" icon={<RightOutlined />} onClick={handleNext} disabled={previewIndex >= getPreviewablePaths().length - 1} title="下一张" />,
            <Button key="close" onClick={() => { 
              setPreviewModalVisible(false)
              setCurrentImageBase64(null)
              handleResetAll() // 关闭时重置所有状态
            }}>关闭</Button>
          </Space>
        ]}
        width="800px"
        height="80%"
        style={{ top: '10%', position: 'relative' }}
      >
        <div style={{
          textAlign: 'center',
          width: '100%',
          height: 'calc(100% - 50px)',
          backgroundColor: '#f0f0f0',
          overflow: 'auto'
        }}>
          {/* 当前状态显示 */}
          <div style={{
            position: 'absolute',
            top: '60px',
            left: '35px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
          }}>
            <Space>
              <span>缩放：{scale}%</span>
              <span>旋转：{((rotation % 360) + 360) % 360}°</span>
            </Space>
          </div>
          {/* 加载状态指示器 */}
          {isLoadingHighRes && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              padding: '16px 32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '3px solid #1890ff',
                borderTop: '3px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <span>正在加载高清图片...</span>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}

          {/* 图片显示 */}
          {currentImageBase64 ? (
            <img
              src={currentImageBase64}
              alt="preview"
              style={{
                maxWidth: '100%',
                height: '450px',
                objectFit: 'contain',
                display: 'block',
                margin: '0 auto',
                transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
                opacity: isLoadingHighRes ? 0.7 : 1,
                transform: `scale(${scale / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center'
              }}
              onError={() => setImageLoadError(true)}
            />
          ) : <Empty description="加载中或不支持的图片" />}

          {/* 错误处理 */}
          {imageLoadError && (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ff4d4f',
              gap: '16px'
            }}>
              <div style={{ fontSize: '48px' }}>❌</div>
              <div>图片加载失败</div>
              <Button
                type="primary"
                onClick={() => showPreviewAt(previewIndex)}
              >
                重试
              </Button>
            </div>
          )}

          {/* 初始加载状态 */}
          {!currentImageBase64 && !isLoadingHighRes && !imageLoadError && (
            <div style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999'
            }}>
              准备加载图片...
            </div>
          )}
        </div>
      </Modal>
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

