import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, Modal, Input, message, Space } from 'antd'
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
import ImageEditor from '../ImageEditor/ImageEditor'
import BatchEditModal from '../ImageEditor/BatchEditModal'
import { SelectionActionBar } from '../UnifiedUI'
import ImageViewer from '../ImageViewer/ImageViewer'
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
  const [selectedQuality, setSelectedQuality] = useState<string>('all')
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renamingFile, setRenamingFile] = useState<FileInfo | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deletingFile, setDeletingFile] = useState<FileInfo | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [selectedRows, setSelectedRows] = useState<FileInfo[]>([])
  const [batchRenameModalVisible, setBatchRenameModalVisible] = useState(false)
  // view mode can be list or grid; default to grid and remember user choice across sessions
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    const saved = localStorage.getItem('file_list_view_mode')
    if (saved === 'list' || saved === 'grid') {
      return saved
    }
    return 'grid'
  })
  const [batchRenamePrefix, setBatchRenamePrefix] = useState('')
  const [batchRenameSuffix, setBatchRenameSuffix] = useState('')
  const [moveModalVisible, setMoveModalVisible] = useState(false)
  const [moveTargetPath, setMoveTargetPath] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [gridColumns, setGridColumns] = useState(5)

  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [previewableFiles, setPreviewableFiles] = useState<FileInfo[]>([])

  // 编辑器
  const [editorVisible, setEditorVisible] = useState(false)
  const [editorFilePath, setEditorFilePath] = useState<string | null>(null)
  const [batchEditorVisible, setBatchEditorVisible] = useState(false)
  const [isAnalyzingImages, setIsAnalyzingImages] = useState(false)

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
  }, [fileList, pageSize, selectedCategory, selectedSubExtensions, selectedImageCategory, selectedQuality])

  useEffect(() => {
    setSelectedImageCategory('all')
    setSelectedQuality('all')
  }, [currentPath])

  const isPreviewable = useCallback((file: FileInfo): boolean => {
    if (file.isDirectory) return false
    const ext = getFileExtension(file.name).toLowerCase()
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']
    return imageExtensions.includes(ext)
  }, [])

  const getImageFiles = useCallback(() => {
    return fileList.filter(f => !f.isDirectory && isPreviewable(f))
  }, [fileList, isPreviewable])

  const handleEdit = useCallback((file: FileInfo) => {
    setEditorFilePath(file.path)
    setEditorVisible(true)
  }, [])

  const handleBatchEdit = useCallback(() => {
    if (selectedRows.length > 0) {
      setBatchEditorVisible(true)
    }
  }, [selectedRows])

  const handlePreview = useCallback(async (file: FileInfo) => {
    const imageFiles = getImageFiles()
    const index = imageFiles.findIndex(f => f.path === file.path)
    if (index >= 0) {
      setPreviewableFiles(imageFiles)

      const imageUrls: string[] = imageFiles.map((f) => {
        const previewData = previews.get(f.path)
        if (previewData?.full?.trim()) {
          return previewData.full
        }
        return `file://${f.path}`
      })

      setPreviewImages(imageUrls)
      setPreviewIndex(index)
      setPreviewModalVisible(true)
    }
  }, [getImageFiles, previews])

  const handlePreviewIndexChange = useCallback((newIndex: number) => {
    setPreviewIndex(newIndex)
  }, [])

  const filteredFileList = useMemo(() => {
    let files = filterFiles(fileList, selectedCategory, selectedSubExtensions)

    if (selectedImageCategory !== 'all') {
      files = files.filter(file => {
        const classification = imageClassificationResults.get(file.path)
        return classification && classification.category === selectedImageCategory
      })
    }

    if (selectedQuality !== 'all') {
      files = files.filter(file => {
        const classification = imageClassificationResults.get(file.path)
        return classification?.quality === selectedQuality
      })
    }

    return files
  }, [fileList, selectedCategory, selectedSubExtensions, imageClassificationResults, selectedImageCategory, selectedQuality])

  const handleGoBack = useCallback(() => {
    if (!currentPath) return

    const currentIndex = historyList.findIndex(item => item.path === currentPath)
    if (currentIndex >= 0 && currentIndex < historyList.length - 1) {
      const previousPath = historyList[currentIndex + 1].path
      loadDirectory(previousPath, false)
      return
    }

    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
    loadDirectory(parentPath, false)
  }, [currentPath, historyList, loadDirectory])

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
    try {
      localStorage.setItem('file_list_view_mode', mode)
    } catch {
      /* ignore */
    }
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

  const performBatchDelete = useCallback(
    async (files: FileInfo[]) => {
      if (files.length === 0) return
      let successCount = 0
      for (const file of files) {
        const success = await window.electronAPI?.deleteFile(file.path)
        if (success) successCount++
      }
      message.success(`批量删除完成：成功 ${successCount} 个，失败 ${files.length - successCount} 个`)
      setSelectedRowKeys([])
      setSelectedRows([])
      if (currentPath) {
        loadDirectory(currentPath)
      }
    },
    [currentPath, loadDirectory]
  )

  const handleBatchDelete = useCallback(() => {
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
      onOk: () => performBatchDelete(selectedRows),
    })
  }, [selectedRows, performBatchDelete])

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
      loadDirectory(file.path)
    } else if (isPreviewable(file)) {
      handlePreview(file)
    } else {
      if (window.electronAPI && window.electronAPI.openFile) {
        await window.electronAPI.openFile(file.path)
      }
    }
  }, [loadDirectory, isPreviewable, handlePreview])

  const handleSelectionChange = useCallback((keys: string[], rows: FileInfo[]) => {
    setSelectedRowKeys(keys)
    setSelectedRows(rows)
  }, [])

  /** 网格仅回传 path keys，需按全量筛选列表还原 row，顶部批量删除等依赖 selectedRows */
  const handleGridSelectionChange = useCallback(
    (keys: string[]) => {
      setSelectedRowKeys(keys)
      setSelectedRows(filteredFileList.filter(f => keys.includes(f.path)))
    },
    [filteredFileList]
  )

  const handlePageChange = useCallback((page: number, pageSize: number) => {
    setCurrentPage(page)
    setPageSize(pageSize)
  }, [])

  const analyzableImageCount = useMemo(
    () => fileList.filter(f => !f.isDirectory && isPreviewable(f)).length,
    [fileList, isPreviewable]
  )

  const hasClassifiedImagesInFolder = useMemo(
    () => fileList.some(f => !f.isDirectory && imageClassificationResults.has(f.path)),
    [fileList, imageClassificationResults]
  )

  const handleAnalyzeImages = useCallback(async () => {
    const imagePaths = fileList.filter(f => !f.isDirectory && isPreviewable(f)).map(f => f.path)
    if (imagePaths.length === 0) {
      message.warning('当前目录没有可分析的图片')
      return
    }
    if (!window.electronAPI?.classifyImagesBatch) {
      message.error('图片分析不可用')
      return
    }
    let modelOk = true
    try {
      modelOk = (await window.electronAPI.checkModelExists?.()) ?? false
    } catch {
      modelOk = false
    }
    if (!modelOk) {
      message.warning('请先下载图片分类模型（可在「图片分类」页下载）')
      return
    }
    setIsAnalyzingImages(true)
    try {
      const result = await window.electronAPI.classifyImagesBatch({
        imagePaths,
        batchSize: 8,
        modelId: 'clip_vit_b32_quant'
      })
      const prev = new Map(useImageClassificationStore.getState().results)
      for (const r of result.results) {
        prev.set(r.filePath, r)
      }
      useImageClassificationStore.getState().setResults(Array.from(prev.values()))
      message.success(`分析完成：成功 ${result.successCount} 张，失败 ${result.errorCount} 张`)
    } catch (e) {
      message.error('分析失败：' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setIsAnalyzingImages(false)
    }
  }, [fileList, isPreviewable])

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedFileList = filteredFileList.slice(startIndex, endIndex)

  if (!currentPath) {
    return (
      <Card title="文件列表" className="app-surface-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="app-empty-state is-panel">
          <div className="app-empty-state__icon">📁</div>
          <div className="app-empty-state__title">请先选择目录</div>
          <div className="app-empty-state__description">选择左侧目录后，文件列表、筛选和图片预览会在这里展示。</div>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card
        title={
          <FileListHeader
            currentPath={currentPath}
            selectedCategory={selectedCategory}
            selectedSubExtensions={selectedSubExtensions}
            selectedImageCategory={selectedImageCategory}
            selectedQuality={selectedQuality}
            filteredFileList={filteredFileList}
            analyzableImageCount={analyzableImageCount}
            hasClassifiedImagesInFolder={hasClassifiedImagesInFolder}
            isAnalyzingImages={isAnalyzingImages}
            onAnalyzeImages={handleAnalyzeImages}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onGoBack={handleGoBack}
            onCategoryChange={handleCategoryChange}
            onSubExtensionChange={handleSubExtensionChange}
            onResetFilter={handleResetFilter}
            onImageCategoryChange={setSelectedImageCategory}
            onQualityChange={setSelectedQuality}
          />
        }
        className="app-surface-card"
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ padding: 0, flex: 1, overflow: 'hidden' }}
      >
        {selectedRows.length > 0 && (
          <SelectionActionBar
            summary={`已选择 ${selectedRows.length} 项`}
            onClear={() => { setSelectedRowKeys([]); setSelectedRows([]) }}
          >
              <AntButton size="small" danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
                批量删除
              </AntButton>
              <AntButton size="small" icon={<EditOutlined />} onClick={handleBatchRename}>
                批量重命名
              </AntButton>
              <AntButton size="small" icon={<FolderOpenOutlined />} onClick={handleBatchMove}>
                批量移动
              </AntButton>
              <AntButton size="small" icon={<EditOutlined />} onClick={handleBatchEdit}>
                批量编辑
              </AntButton>
          </SelectionActionBar>
        )}

        {/* container holds either table or grid; use flex layout and hide overflow so the child components manage scrolling internally */}
        <div style={{ flex: 1,height:"100%", minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
              onEdit={handleEdit}
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
              current={currentPage}
              pageSize={pageSize}
              previewVersion={previewVersion}
              gridColumns={gridColumns}
              previews={previews}
              loadingImages={loadingImages}
              progress={progress}
              selectedRowKeys={selectedRowKeys}
              maxImageSize={maxImageSize}
              onPreview={handlePreview}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDoubleClick={handleDoubleClick}
              onSelectionChange={handleGridSelectionChange}
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
          images={previewImages.map((src, index) => {
            const f = previewableFiles[index]
            return {
              id: `${index}-${src}`,
              url: src,
              filePath: f?.path,
              filename: f?.name || `image-${index + 1}`,
              width: 0,
              height: 0,
              size: f?.size ?? 0,
              format: getFileExtension(f?.name || 'jpg'),
              createdAt: f ? new Date(f.createdTime).toISOString() : '',
              modifiedAt: f ? new Date(f.modifiedTime).toISOString() : ''
            }
          })}
          currentIndex={previewIndex}
          onIndexChange={handlePreviewIndexChange}
          onClose={() => setPreviewModalVisible(false)}
        />
      )}

      {editorVisible && editorFilePath && (
        <ImageEditor
          visible={editorVisible}
          filePath={editorFilePath}
          onClose={() => setEditorVisible(false)}
          onSaved={(result) => {
            if (result?.success) {
              // image was modified – invalidate any cached previews and reload directory
              imageLoader.clearCache(result.filePath)
              clearCache()
              // reload current folder to refresh metadata/modified time
              loadDirectory(currentPath)
            }
          }}
        />
      )}

      {batchEditorVisible && (
        <BatchEditModal
          visible={batchEditorVisible}
          filePaths={selectedRows.map(r => r.path)}
          onClose={() => setBatchEditorVisible(false)}
        />
      )}
    </>
  )
}

export default FileList
