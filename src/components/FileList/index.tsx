import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, Modal, Input, message, Space, Empty } from 'antd'
import { Button as AntButton } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined
} from '@ant-design/icons'
import { useFileStore } from '../../stores'
import { useImageClassificationStore } from '../../stores'
import { useFileSystem } from '../../hooks'
import { filterFiles, getFileExtension, imageLoader } from '../../utils'
import { useFilePreview } from './useFilePreview'
import { FileListHeader } from './FileListHeader'
import { FileListTable } from './FileListTable'
import { FileListGrid } from './FileListGrid'
import ImageViewer from '../ImageViewer/ImageViewer'
import type { Image } from '../ImageViewer/types'
import type { FileInfo } from '../../types'
import { MAX_IMAGE_SIZE } from './types'

const FileList: React.FC = () => {
  const {
    fileList,
    loading,
    currentPath,
    historyList,
    selectedCategory,
    selectedSubExtensions,
    setSelectedCategory,
    setSelectedSubExtensions,
    resetFilter,
    imageClassificationResults,
    setImageClassificationResults
  } = useFileStore()

  const { loadDirectory } = useFileSystem()
  const { results: classificationResultsFromStore } = useImageClassificationStore()

  const [selectedImageCategory, setSelectedImageCategory] = useState<string>('all')
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renamingFile, setRenamingFile] = useState<FileInfo | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deletingFile, setDeletingFile] = useState<FileInfo | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [selectedRows, setSelectedRows] = useState<FileInfo[]>([])
  const [batchRenameModalVisible, setBatchRenameModalVisible] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [batchRenamePrefix, setBatchRenamePrefix] = useState('')
  const [batchRenameSuffix, setBatchRenameSuffix] = useState('')
  const [moveModalVisible, setMoveModalVisible] = useState(false)
  const [moveTargetPath, setMoveTargetPath] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [gridColumns, setGridColumns] = useState(5)

  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewImages, setPreviewImages] = useState<Image[]>([])
  const [previewableFiles, setPreviewableFiles] = useState<FileInfo[]>([])

  const previewEnabled = true

  const {
    previews,
    loadingImages,
    progress,
    previewVersion,
    setFiles,
    clearCache,
    registerImageRef,
    maxImageSize
  } = useFilePreview({
    enabled: previewEnabled,
    maxImageSize: MAX_IMAGE_SIZE
  })

  useEffect(() => {
    if (classificationResultsFromStore.size > 0) {
      const results = Array.from(classificationResultsFromStore.values())
      setImageClassificationResults(results)
    }
  }, [classificationResultsFromStore, setImageClassificationResults])

  useEffect(() => {
    setFiles(fileList)
  }, [fileList, setFiles])

  useEffect(() => {
    clearCache()
  }, [currentPath, clearCache])

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

    updateGridColumns()
    window.addEventListener('resize', updateGridColumns)
    return () => window.removeEventListener('resize', updateGridColumns)
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [fileList, pageSize, selectedCategory, selectedSubExtensions])

  const isPreviewable = useCallback((file: FileInfo): boolean => {
    if (file.isDirectory) return false
    const ext = getFileExtension(file.name).toLowerCase()
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']
    return imageExtensions.includes(ext)
  }, [])

  const getImageFiles = useCallback(() => {
    return fileList.filter(f => !f.isDirectory && isPreviewable(f))
  }, [fileList, isPreviewable])

  const convertFileToImage = useCallback(async (file: FileInfo, imageUrl: string): Promise<Image> => {
    let width = 0
    let height = 0

    try {
      const dimensions = await window.electronAPI?.getImageDimensions(file.path)
      if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
        width = dimensions.width
        height = dimensions.height
      } else {
        throw new Error('无法从 electron 端获取尺寸')
      }
    } catch (error) {
      try {
        const img = new Image()
        img.src = imageUrl
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('加载超时')), 10000)
          img.onload = () => {
            clearTimeout(timeout)
            width = img.naturalWidth || img.width || 0
            height = img.naturalHeight || img.height || 0
            resolve()
          }
          img.onerror = () => {
            clearTimeout(timeout)
            reject(new Error('图片加载失败'))
          }
        })
      } catch (imgError) {
        width = 1920
        height = 1080
      }
    }

    let classification = undefined
    try {
      const savedResults = localStorage.getItem('image_classification_results')
      if (savedResults) {
        const resultsMap = JSON.parse(savedResults)
        const classificationResult = resultsMap[file.path]
        if (classificationResult) {
          classification = classificationResult
        }
      }
    } catch (e) {
      console.warn('加载分类结果失败:', e)
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
      tags: [],
      classification
    }
  }, [])

  const loadImageForPreview = useCallback(async (index: number, filePath: string, file: FileInfo) => {
    const previewData = previews.get(filePath)
    if (previewData?.full?.trim()) {
      const image = await convertFileToImage(file, previewData.full)
      setPreviewImages(prev => {
        const newImages = [...prev]
        newImages[index] = image
        return newImages
      })
      return
    }

    try {
      const result = await imageLoader.loadSmart(filePath, {
        useCache: true,
        timeout: 20000,
        retryCount: 1,
        fallbackSize: 200,
        fallbackQuality: 70
      })

      if (result.data) {
        const image = await convertFileToImage(file, result.data)
        setPreviewImages(prev => {
          const newImages = [...prev]
          newImages[index] = image
          return newImages
        })
      }
    } catch (error) {
      console.error('加载图片失败:', error)
    }
  }, [previews, convertFileToImage])

  const handlePreview = useCallback(async (file: FileInfo) => {
    const imageFiles = getImageFiles()
    const index = imageFiles.findIndex(f => f.path === file.path)
    if (index >= 0) {
      setPreviewableFiles(imageFiles)

      const initialImages: Image[] = imageFiles.map((f) => ({
        id: f.path,
        url: '',
        filename: f.name,
        width: 0,
        height: 0,
        size: f.size,
        format: getFileExtension(f.name).toLowerCase() || 'unknown',
        createdAt: new Date(f.createdTime).toISOString(),
        modifiedAt: new Date(f.modifiedTime).toISOString(),
        description: '',
        tags: [],
        classification: undefined
      }))

      setPreviewImages(initialImages)
      setPreviewIndex(index)

      try {
        await loadImageForPreview(index, imageFiles[index].path, imageFiles[index])
        setPreviewModalVisible(true)
      } catch (error) {
        console.error('加载第一张图片失败:', error)
        setPreviewModalVisible(true)
      }
    }
  }, [getImageFiles, loadImageForPreview])

  const handlePreviewIndexChange = useCallback(async (newIndex: number) => {
    setPreviewIndex(newIndex)
    if (previewableFiles[newIndex]) {
      const currentImage = previewImages[newIndex]
      if (!currentImage || !currentImage.url || currentImage.url.trim() === '') {
        await loadImageForPreview(newIndex, previewableFiles[newIndex].path, previewableFiles[newIndex])
      }
    }
  }, [previewableFiles, previewImages, loadImageForPreview])

  const filteredFileList = useMemo(() => {
    let files = filterFiles(fileList, selectedCategory, selectedSubExtensions)

    if (selectedImageCategory !== 'all') {
      files = files.filter(file => {
        const classification = imageClassificationResults.get(file.path)
        return classification && classification.category === selectedImageCategory
      })
    }

    return files
  }, [fileList, selectedCategory, selectedSubExtensions, imageClassificationResults, selectedImageCategory])

  const handleGoBack = useCallback(() => {
    if (!currentPath) return
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
    loadDirectory(parentPath)
  }, [currentPath, loadDirectory])

  const handleCategoryChange = useCallback((value: string) => {
    setSelectedCategory(value as 'all' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other')
  }, [setSelectedCategory])

  const handleSubExtensionChange = useCallback((value: string[]) => {
    setSelectedSubExtensions(value)
  }, [setSelectedSubExtensions])

  const handleResetFilter = useCallback(() => {
    resetFilter()
  }, [resetFilter])

  const handleViewModeChange = useCallback((mode: 'list' | 'grid') => {
    setViewMode(mode)
  }, [])

  const handleRename = useCallback((file: FileInfo) => {
    setRenamingFile(file)
    setNewFileName(file.name)
    setRenameModalVisible(true)
  }, [])

  const handleRenameConfirm = useCallback(async () => {
    if (!renamingFile || !newFileName.trim()) return

    try {
      const success = await window.electronAPI?.renameFile(renamingFile.path, newFileName.trim())
      if (success) {
        message.success('重命名成功')
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
  }, [renamingFile, newFileName, currentPath, loadDirectory])

  const handleDelete = useCallback((file: FileInfo) => {
    setDeletingFile(file)
    setDeleteModalVisible(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingFile) return

    try {
      const success = await window.electronAPI?.deleteFile(deletingFile.path)
      if (success) {
        message.success('删除成功')
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
  }, [deletingFile, currentPath, loadDirectory])

  const handleBatchDelete = useCallback(async () => {
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
      }
    })
  }, [selectedRows, currentPath, loadDirectory])

  const handleBatchRename = useCallback(() => {
    if (selectedRows.length === 0) {
      message.warning('请先选择要重命名的文件')
      return
    }
    setBatchRenameModalVisible(true)
  }, [selectedRows])

  const handleBatchRenameConfirm = useCallback(async () => {
    if (selectedRows.length === 0) return

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
  }, [selectedRows, batchRenamePrefix, batchRenameSuffix, currentPath, loadDirectory])

  const handleBatchMove = useCallback(() => {
    if (selectedRows.length === 0) {
      message.warning('请先选择要移动的文件')
      return
    }
    setMoveModalVisible(true)
    setMoveTargetPath('')
  }, [selectedRows])

  const handleBatchMoveConfirm = useCallback(async () => {
    if (selectedRows.length === 0 || !moveTargetPath.trim()) return

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
  }, [selectedRows, moveTargetPath, currentPath, loadDirectory])

  const handleDoubleClick = useCallback(async (file: FileInfo) => {
    if (file.isDirectory) {
      loadDirectory(file.path, false)
    } else {
      if (window.electronAPI && window.electronAPI.openFile) {
        await window.electronAPI.openFile(file.path)
      }
    }
  }, [loadDirectory])

  const handleSelectionChange = useCallback((keys: string[], rows: FileInfo[]) => {
    setSelectedRowKeys(keys)
    setSelectedRows(rows)
  }, [])

  const handlePageChange = useCallback((page: number, pageSize: number) => {
    setCurrentPage(page)
    setPageSize(pageSize)
  }, [])

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedFileList = filteredFileList.slice(startIndex, endIndex)

  if (!currentPath) {
    return (
      <Card title="文件列表" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Empty description="请先选择目录" />
      </Card>
    )
  }

  return (
    <>
      <Card
        title={
          <FileListHeader
            currentPath={currentPath}
            historyList={historyList}
            selectedCategory={selectedCategory}
            selectedSubExtensions={selectedSubExtensions}
            selectedImageCategory={selectedImageCategory}
            imageClassificationResults={imageClassificationResults}
            filteredFileList={filteredFileList}
            viewMode={viewMode}
            currentPage={currentPage}
            pageSize={pageSize}
            total={filteredFileList.length}
            onGoBack={handleGoBack}
            onCategoryChange={handleCategoryChange}
            onSubExtensionChange={handleSubExtensionChange}
            onResetFilter={handleResetFilter}
            onImageCategoryChange={setSelectedImageCategory}
            onViewModeChange={handleViewModeChange}
            onPageChange={handlePageChange}
          />
        }
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ padding: 0, flex: 1, overflow: 'hidden' }}
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

        <div style={{ flex: 1, overflow: 'auto' }}>
          {viewMode === 'list' ? (
            <FileListTable
              dataSource={paginatedFileList}
              total={filteredFileList.length}
              current={currentPage}
              pageSize={pageSize}
              loading={loading}
              previewEnabled={previewEnabled}
              previewVersion={previewVersion}
              previews={previews}
              loadingImages={loadingImages}
              progress={progress}
              imageClassificationResults={imageClassificationResults}
              selectedRowKeys={selectedRowKeys}
              selectedRows={selectedRows}
              maxImageSize={maxImageSize}
              onPreview={handlePreview}
              onRename={handleRename}
              onDelete={handleDelete}
              onDoubleClick={handleDoubleClick}
              onSelectionChange={handleSelectionChange}
              onRegisterRef={registerImageRef}
              onPageChange={handlePageChange}
              isPreviewable={isPreviewable}
            />
          ) : (
            <FileListGrid
              dataSource={paginatedFileList}
              total={filteredFileList.length}
              previewVersion={previewVersion}
              gridColumns={gridColumns}
              previews={previews}
              loadingImages={loadingImages}
              progress={progress}
              selectedRowKeys={selectedRowKeys}
              maxImageSize={maxImageSize}
              onPreview={handlePreview}
              onDoubleClick={handleDoubleClick}
              onSelectionChange={setSelectedRowKeys}
              onRegisterRef={registerImageRef}
              onPageChange={handlePageChange}
              isPreviewable={isPreviewable}
            />
          )}
        </div>

        <Modal
          title="重命名"
          open={renameModalVisible}
          onOk={handleRenameConfirm}
          onCancel={() => { setRenameModalVisible(false); setRenamingFile(null); setNewFileName('') }}
        >
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="请输入新文件名"
          />
        </Modal>

        <Modal
          title="确认删除"
          open={deleteModalVisible}
          onOk={handleDeleteConfirm}
          onCancel={() => { setDeleteModalVisible(false); setDeletingFile(null) }}
          okButtonProps={{ danger: true }}
        >
          <p>确定要删除文件 "{deletingFile?.name}" 吗？此操作不可撤销。</p>
        </Modal>

        <Modal
          title="批量重命名"
          open={batchRenameModalVisible}
          onOk={handleBatchRenameConfirm}
          onCancel={() => { setBatchRenameModalVisible(false); setBatchRenamePrefix(''); setBatchRenameSuffix('') }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              value={batchRenamePrefix}
              onChange={(e) => setBatchRenamePrefix(e.target.value)}
              placeholder="前缀"
            />
            <Input
              value={batchRenameSuffix}
              onChange={(e) => setBatchRenameSuffix(e.target.value)}
              placeholder="后缀"
            />
          </Space>
        </Modal>

      <Modal
        title="批量移动"
        open={moveModalVisible}
        onOk={handleBatchMoveConfirm}
        onCancel={() => { setMoveModalVisible(false); setMoveTargetPath('') }}
      >
        <Input
          value={moveTargetPath}
          onChange={(e) => setMoveTargetPath(e.target.value)}
          placeholder="目标文件夹名称"
        />
      </Modal>
      </Card>

      {previewModalVisible && previewImages.length > 0 && (
        <ImageViewer
          images={previewImages}
          currentIndex={previewIndex}
          onIndexChange={handlePreviewIndexChange}
          onClose={() => setPreviewModalVisible(false)}
        />
      )}
    </>
  )
}

export default FileList
