import React, { useState } from 'react'
import {
  Card,
  Button,
  Select,
  Radio,
  Input,
  Switch,
  Space,
  Divider,
  message,
  Modal,
  Tabs,
  Tree,
  Segmented
} from 'antd'
import {
  FolderOpenOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  ExportOutlined
} from '@ant-design/icons'
import { useFileStore } from '../stores/fileStore'
import { useFileSystem } from '../hooks/useFileSystem'
import { generatePreview } from '../utils/organizer'
import type { OrganizeRule, OrganizeConfig, PreviewResultItem, SizeRange } from '../types'

const { Option } = Select

// 构建树形数据
const buildTreeData = (results: PreviewResultItem[], currentPath: string) => {
  const treeMap: Record<string, any> = {}

  results.forEach((result) => {
    let targetPath = result.to
    const sourcePath = result.from

    // 转换为相对路径
    targetPath = targetPath.replace(currentPath + '/', '')

    // 解析目标路径
    const pathParts = targetPath.split('/').filter(p => p)
    let currentTreePath = ''

    pathParts.forEach((part, index) => {
      currentTreePath += '/' + part
      if (!treeMap[currentTreePath]) {
        treeMap[currentTreePath] = {
          key: currentTreePath,
          title: part,
          children: [],
          isLeaf: index === pathParts.length - 1
        }
        if (index === pathParts.length - 1) {
          treeMap[currentTreePath].title = `${part} (${sourcePath.split('/').pop()})`
        }
      }
    })
  })

  // 构建树结构
  const root: any = { key: 'root', title: '整理结果', children: [] }

  Object.values(treeMap).forEach((node: any) => {
    const parentPath = node.key.substring(0, node.key.lastIndexOf('/')) || 'root'
    const parent = treeMap[parentPath] || root
    parent.children.push(node)
  })

  return [root]
}

const ControlPanel: React.FC = () => {
  const {
    currentPath,
    fileList,
    setOrganizeConfig,
    previewResults,
    setPreviewResults,
    previewViewMode,
    setPreviewViewMode,
    sizeRanges,
    addSizeRange,
    updateSizeRange,
    deleteSizeRange,
    resetSizeRanges
  } = useFileStore()

  const { selectDirectory, loadDirectory, extractFiles, loadRecursiveDirectoryForPreview } = useFileSystem()

  const [ruleType, setRuleType] = useState<OrganizeRule['type']>('extension')
  const [dateFormat, setDateFormat] = useState<'year' | 'month' | 'day'>('month')
  const [customPattern, _setCustomPattern] = useState('')
  const [includeSubdirs, setIncludeSubdirs] = useState(false)
  const [conflictAction, setConflictAction] = useState<'skip' | 'overwrite' | 'rename'>('rename')
  const [previewVisible, setPreviewVisible] = useState(false)

  // Tab选择状态
  const [activeTab, setActiveTab] = useState<'organize' | 'extract'>('organize')

  // 文件提取相关状态
  const [extractExtensions, setExtractExtensions] = useState('')
  const [extractConflictAction, setExtractConflictAction] = useState<'skip' | 'overwrite' | 'rename'>('rename')

  // 大小范围管理相关状态
  const [sizeRangeModalVisible, setSizeRangeModalVisible] = useState(false)
  const [editingRange, setEditingRange] = useState<SizeRange | null>(null)
  const [rangeName, setRangeName] = useState('')
  const [rangeMinSize, setRangeMinSize] = useState('')
  const [rangeMaxSize, setRangeMaxSize] = useState('')

  // 处理整理
  const handleOrganize = async () => {
    if (!currentPath) {
      message.warning('请先选择目录')
      return
    }

    if (fileList.length === 0) {
      message.warning('当前目录没有文件')
      return
    }

    const rule: OrganizeRule = {
      type: ruleType,
      ...(ruleType === 'date' && { dateFormat }),
      ...(ruleType === 'custom' && { pattern: customPattern })
    }

    const config: OrganizeConfig = {
      sourcePath: currentPath,
      rules: rule,
      options: {
        includeSubdirectories: includeSubdirs,
        conflictAction,
        previewOnly: false
      }
    }

    try {
      if (!window.electronAPI) {
        message.error('Electron API 未初始化，请确保在 Electron 环境中运行')
        return
      }
      setOrganizeConfig(config)
      const results = await window.electronAPI.organizeFiles(config)

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      if (failCount > 0) {
        message.warning(`整理完成：成功 ${successCount} 个，失败 ${failCount} 个`)
      } else {
        message.success(`成功整理 ${successCount} 个文件`)
      }

      // 重新加载目录
      await loadDirectory(currentPath)
    } catch (error: any) {
      message.error(`整理失败: ${error.message}`)
    }
  }

  // 处理文件提取
  const handleExtractFiles = async () => {
    if (!currentPath) {
      message.warning('请先选择目录')
      return
    }

    if (!extractExtensions.trim()) {
      message.warning('请输入文件扩展名')
      return
    }

    // 解析扩展名（支持逗号分隔，去除空格和点号）
    const extensions = extractExtensions
      .split(',')
      .map((ext: string) => ext.trim().toLowerCase().replace(/^\./, ''))
      .filter((ext: string) => ext.length > 0)

    if (extensions.length === 0) {
      message.warning('请输入有效的文件扩展名')
      return
    }

    try {
      await extractFiles(currentPath, extensions, extractConflictAction)
    } catch (error: any) {
      message.error(`提取文件失败: ${error.message}`)
    }
  }

  // 预览整理结果
  const handlePreview = async () => {
    if (!currentPath) {
      message.warning('请先选择目录')
      return
    }

    if (fileList.length === 0) {
      message.warning('当前目录没有文件')
      return
    }

    const rule: OrganizeRule = {
      type: ruleType,
      ...(ruleType === 'date' && { dateFormat }),
      ...(ruleType === 'custom' && { pattern: customPattern })
    }

    const config: OrganizeConfig = {
      sourcePath: currentPath,
      rules: rule,
      options: {
        includeSubdirectories: includeSubdirs,
        conflictAction,
        previewOnly: true
      }
    }

    try {
      // 如果包含子目录，使用递归加载的文件列表
      const filesToPreview = includeSubdirs
        ? await loadRecursiveDirectoryForPreview(currentPath)
        : fileList

      const results = await generatePreview(filesToPreview, config, sizeRanges)
      setPreviewResults(results)
      setPreviewVisible(true)
    } catch (error: any) {
      message.error(`预览失败: ${error.message}`)
    }
  }

  return (
    <Card title="整理控制面板" >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 选择目录 */}
        <Button
          type="primary"
          icon={<FolderOpenOutlined />}
          block
          onClick={selectDirectory}
        >
          选择目录
        </Button>

        {!currentPath ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px', 
            color: '#999',
            background: '#f5f5f5',
            borderRadius: 8
          }}>
            <FolderOpenOutlined style={{ fontSize: 48, marginBottom: 16, color: '#bfbfbf' }} />
            <div style={{ fontSize: 14 }}>请先选择要整理的目录</div>
            <div style={{ fontSize: 12, marginTop: 8 }}>点击上方的"选择目录"按钮开始</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: '#666', wordBreak: 'break-all' }}>
              当前目录: {currentPath}
            </div>

            <Tabs
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key as 'organize' | 'extract')}
              items={[
                {
                  key: 'organize',
                  label: '分类',
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      {/* 分类方式 */}
                      <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>分类方式：</div>
                        <Select
                          value={ruleType}
                          onChange={setRuleType}
                          style={{ width: '100%' }}
                        >
                          <Option value="extension">按文件类型（扩展名）</Option>
                          <Option value="date">按修改日期</Option>
                          <Option value="size">按文件大小</Option>
                          <Option value="custom">自定义规则（正则）</Option>
                        </Select>
                      </div>

                      {/* 日期格式选择 */}
                      {ruleType === 'date' && (
                        <div>
                          <div style={{ marginBottom: 8, fontWeight: 500 }}>日期格式：</div>
                          <Radio.Group
                            value={dateFormat}
                            onChange={(e: any) => setDateFormat(e.target.value)}
                            style={{ width: '100%' }}
                          >
                            <Radio value="year">按年</Radio>
                            <Radio value="month">按月</Radio>
                            <Radio value="day">按日</Radio>
                          </Radio.Group>
                        </div>
                      )}

                      {/* 文件大小范围管理 */}
                      {ruleType === 'size' && (
                        <div>
                          <div style={{ marginBottom: 8, fontWeight: 500 }}>文件大小分类范围：</div>
                          <div style={{ marginBottom: 8 }}>
                            <Button
                              type="link"
                              size="small"
                              onClick={() => setSizeRangeModalVisible(true)}
                            >
                              管理分类范围 ({sizeRanges.length}个)
                            </Button>
                          </div>
                          <div style={{ fontSize: 12, color: '#666' }}>
                            {sizeRanges.map(range => (
                              <div key={range.id}>
                                {range.name}: {range.minSize === 0 ? '0' : `${(range.minSize / (1024 * 1024)).toFixed(1)}MB`} -
                                {range.maxSize === Number.MAX_SAFE_INTEGER ? '∞' : `${(range.maxSize / (1024 * 1024)).toFixed(1)}MB`}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Divider />

                      {/* 选项设置 */}
                      <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>选项设置：</div>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <div>
                            <Switch
                              checked={includeSubdirs}
                              onChange={setIncludeSubdirs}
                            />
                            <span style={{ marginLeft: 8 }}>包含子目录</span>
                          </div>
                          <div>
                            <div style={{ marginBottom: 4 }}>冲突处理：</div>
                            <Radio.Group
                              value={conflictAction}
                              onChange={(e: any) => setConflictAction(e.target.value)}
                            >
                              <Radio value="skip">跳过</Radio>
                              <Radio value="overwrite">覆盖</Radio>
                              <Radio value="rename">重命名</Radio>
                            </Radio.Group>
                          </div>
                        </Space>
                      </div>

                      <Divider />

                      {/* 操作按钮 */}
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Button
                          type="default"
                          icon={<EyeOutlined />}
                          block
                          onClick={handlePreview}
                          disabled={!currentPath}
                        >
                          预览整理结果
                        </Button>
                        <Button
                          type="primary"
                          icon={<PlayCircleOutlined />}
                          block
                          onClick={handleOrganize}
                          disabled={!currentPath}
                        >
                          开始整理
                        </Button>
                      </Space>
                    </Space>
                  )
                },
                {
                  key: 'extract',
                  label: '提取',
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      {/* 文件提取功能 */}
                      <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>文件扩展名：</div>
                        <Input
                          placeholder="输入文件扩展名，多个用逗号分隔（如：jpg,png,pdf）"
                          value={extractExtensions}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExtractExtensions(e.target.value)}
                        />
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                          将子目录中指定类型的文件提取到当前目录
                        </div>
                      </div>

                      <Divider />

                      <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>冲突处理：</div>
                        <Radio.Group
                          value={extractConflictAction}
                          onChange={(e: any) => setExtractConflictAction(e.target.value)}
                        >
                          <Radio value="skip">跳过</Radio>
                          <Radio value="overwrite">覆盖</Radio>
                          <Radio value="rename">重命名</Radio>
                        </Radio.Group>
                      </div>

                      <Divider />

                      <Button
                        type="primary"
                        icon={<ExportOutlined />}
                        block
                        onClick={handleExtractFiles}
                        disabled={!currentPath || !extractExtensions.trim()}
                      >
                        提取文件到当前目录
                      </Button>
                    </Space>
                  )
                }
              ]}
            />
          </>
        )}
      </Space>

      {/* 预览模态框 */}
      <Modal
        title={
          <Space>
            整理预览
            <Segmented
              value={previewViewMode}
              onChange={(value) => setPreviewViewMode(value as 'list' | 'tree' | 'grid')}
              options={[
                { label: '列表', value: 'list' },
                { label: '树形', value: 'tree' },
                { label: '网格', value: 'grid' }
              ]}
            />
          </Space>
        }
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>
        ]}
        width={1000}
      >
        <div style={{ maxHeight: 600, overflow: 'auto' }}>
          {previewViewMode === 'list' && (
            <>
              {previewResults.map((result: PreviewResultItem, index: number) => (
                <div key={index} style={{ marginBottom: 8, fontSize: 12 }}>
                  <div style={{ color: '#666' }}>从: {result.from.replace(currentPath + '/', '')}</div>
                  <div style={{ color: '#1890ff' }}>到: {result.to.replace(currentPath + '/', '')}</div>
                  {index < previewResults.length - 1 && <Divider style={{ margin: '8px 0' }} />}
                </div>
              ))}
            </>
          )}
          {previewViewMode === 'tree' && (
            <Tree
              treeData={buildTreeData(previewResults, currentPath || '')}
              defaultExpandAll
            />
          )}
          {previewViewMode === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {previewResults.map((result: PreviewResultItem, index: number) => (
                <Card key={index} size="small" style={{ fontSize: 12 }}>
                  <div style={{ color: '#666', marginBottom: 4 }}>来源:</div>
                  <div style={{ wordBreak: 'break-all', fontSize: 11 }}>{result.from.replace(currentPath + '/', '')}</div>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ color: '#1890ff', marginBottom: 4 }}>目标:</div>
                  <div style={{ wordBreak: 'break-all', fontSize: 11 }}>{result.to.replace(currentPath + '/', '')}</div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* 大小范围管理模态框 */}
      <Modal
        title="管理文件大小分类范围"
        open={sizeRangeModalVisible}
        onCancel={() => {
          setSizeRangeModalVisible(false)
          setEditingRange(null)
          setRangeName('')
          setRangeMinSize('')
          setRangeMaxSize('')
        }}
        footer={[
          <Button key="reset" onClick={() => {
            resetSizeRanges()
            message.success('已重置为默认范围')
          }}>
            重置为默认
          </Button>,
          <Button key="close" onClick={() => {
            setSizeRangeModalVisible(false)
            setEditingRange(null)
            setRangeName('')
            setRangeMinSize('')
            setRangeMaxSize('')
          }}>
            关闭
          </Button>
        ]}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 8, color: '#666' }}>
            当前档次: {sizeRanges.length} 个 (最多5个，最少1个)
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            {sizeRanges.map((range) => (
              <Card key={range.id} size="small" style={{ backgroundColor: '#f9f9f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{range.name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {range.minSize === 0 ? '0' : `${(range.minSize / (1024 * 1024)).toFixed(1)}MB`} -
                      {range.maxSize === Number.MAX_SAFE_INTEGER ? '∞' : `${(range.maxSize / (1024 * 1024)).toFixed(1)}MB`}
                    </div>
                  </div>
                  <Space>
                    <Button
                      size="small"
                      onClick={() => {
                        setEditingRange(range)
                        setRangeName(range.name)
                        setRangeMinSize(range.minSize === 0 ? '' : (range.minSize / (1024 * 1024)).toString())
                        setRangeMaxSize(range.maxSize === Number.MAX_SAFE_INTEGER ? '' : (range.maxSize / (1024 * 1024)).toString())
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      danger
                      disabled={sizeRanges.length <= 1}
                      onClick={() => {
                        const success = deleteSizeRange(range.id)
                        if (!success) {
                          message.error('至少需要保留1个分类范围')
                        } else {
                          message.success('删除成功')
                        }
                      }}
                    >
                      删除
                    </Button>
                  </Space>
                </div>
              </Card>
            ))}
          </Space>
        </div>

        <Divider />

        <div>
          <div style={{ fontWeight: 500, marginBottom: 16 }}>
            {editingRange ? '编辑分类范围' : '添加新分类范围'}
          </div>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 4 }}>分类名称：</div>
              <Input
                placeholder="例如：小文件、中等文件、大文件"
                value={rangeName}
                onChange={(e) => setRangeName(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 4 }}>最小大小 (MB)：</div>
                <Input
                  type="number"
                  placeholder="留空表示0"
                  value={rangeMinSize}
                  onChange={(e) => setRangeMinSize(e.target.value)}
                  min="0"
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 4 }}>最大大小 (MB)：</div>
                <Input
                  type="number"
                  placeholder="留空表示无上限"
                  value={rangeMaxSize}
                  onChange={(e) => setRangeMaxSize(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <Space>
              <Button
                type="primary"
                disabled={!rangeName.trim() || sizeRanges.length >= 5}
                onClick={() => {
                  const minSize = rangeMinSize ? parseFloat(rangeMinSize) * 1024 * 1024 : 0
                  const maxSize = rangeMaxSize ? parseFloat(rangeMaxSize) * 1024 * 1024 : Number.MAX_SAFE_INTEGER

                  if (maxSize <= minSize) {
                    message.error('最大大小必须大于最小大小')
                    return
                  }

                  if (editingRange) {
                    const success = updateSizeRange(editingRange.id, {
                      name: rangeName.trim(),
                      minSize,
                      maxSize
                    })
                    if (success) {
                      message.success('更新成功')
                      setEditingRange(null)
                      setRangeName('')
                      setRangeMinSize('')
                      setRangeMaxSize('')
                    } else {
                      message.error('范围重叠或无效，请检查输入')
                    }
                  } else {
                    const success = addSizeRange({
                      name: rangeName.trim(),
                      minSize,
                      maxSize
                    })
                    if (success) {
                      message.success('添加成功')
                      setRangeName('')
                      setRangeMinSize('')
                      setRangeMaxSize('')
                    } else {
                      message.error('范围重叠或已达到最大档次限制')
                    }
                  }
                }}
              >
                {editingRange ? '更新' : '添加'}
              </Button>
              {editingRange && (
                <Button
                  onClick={() => {
                    setEditingRange(null)
                    setRangeName('')
                    setRangeMinSize('')
                    setRangeMaxSize('')
                  }}
                >
                  取消编辑
                </Button>
              )}
            </Space>
          </Space>
        </div>
      </Modal>
    </Card>
  )
}

export default ControlPanel

