import React, { useState, useMemo } from 'react'
import { Modal, Button, Space, List, Card, Input, Select, InputNumber, Radio, Checkbox, message, Progress, Typography } from 'antd'
import { FolderOpenOutlined, ArrowRightOutlined, FolderOutlined } from '@ant-design/icons'
import type { BatchRenameOptions, RenameResult } from '../../../types'

const { Text } = Typography

interface BatchRenameProps {
  visible: boolean
  onClose: () => void
  selectedFiles?: string[]
}

type RenameMode = 'sequence' | 'date' | 'replace' | 'prefix' | 'suffix'

const BatchRename: React.FC<BatchRenameProps> = ({ visible, onClose, selectedFiles = [] }) => {
  const [files, setFiles] = useState<string[]>(selectedFiles)
  const [mode, setMode] = useState<RenameMode>('sequence')
  const [sequenceStart, setSequenceStart] = useState(1)
  const [sequencePadding, setSequencePadding] = useState(3)
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD')
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [conflictAction, setConflictAction] = useState<'skip' | 'overwrite' | 'rename'>('rename')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const getDefaultOutputPath = (fileList: string[]) => {
    if (fileList.length === 0) return ''
    const firstFile = fileList[0]
    const lastSlash = Math.max(firstFile.lastIndexOf('/'), firstFile.lastIndexOf('\\'))
    return lastSlash > 0 ? firstFile.substring(0, lastSlash) : ''
  }

  const handleSelectFiles = async () => {
    if (window.electronAPI?.selectFiles) {
      const selected = await window.electronAPI.selectFiles('image')
      if (selected && selected.length > 0) {
        setFiles(selected)
        if (!outputPath) {
          setOutputPath(getDefaultOutputPath(selected))
        }
      }
    }
  }

  const handleSelectOutputPath = async () => {
    if (window.electronAPI?.openDirectory) {
      const dir = await window.electronAPI.openDirectory()
      if (dir) {
        setOutputPath(dir)
      }
    }
  }

  const displayOutputPath = outputPath || getDefaultOutputPath(files)

  const previewResults = useMemo(() => {
    return files.map((filePath, index) => {
      const fileName = filePath.split(/[/\\]/).pop() || ''
      const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : ''
      const baseName = ext ? fileName.slice(0, -ext.length) : fileName
      let newName = baseName

      switch (mode) {
        case 'sequence': {
          const num = (sequenceStart + index).toString().padStart(sequencePadding, '0')
          newName = `${num}${ext}`
          break
        }
        case 'date': {
          const now = new Date()
          const dateStr = dateFormat
            .replace('YYYY', now.getFullYear().toString())
            .replace('MM', (now.getMonth() + 1).toString().padStart(2, '0'))
            .replace('DD', now.getDate().toString().padStart(2, '0'))
          newName = `${dateStr}_${baseName}${ext}`
          break
        }
        case 'replace': {
          if (findText) {
            const regex = new RegExp(findText, caseSensitive ? 'g' : 'gi')
            newName = baseName.replace(regex, replaceText) + ext
          } else {
            newName = baseName + ext
          }
          break
        }
        case 'prefix': {
          newName = prefix + baseName + ext
          break
        }
        case 'suffix': {
          newName = baseName + suffix + ext
          break
        }
      }

      const finalOutputPath = outputPath || getDefaultOutputPath(files)
      const newPath = finalOutputPath 
        ? `${finalOutputPath}/${newName}`.replace(/\\/g, '/')
        : filePath.replace(/[/\\][^/\\]+$/, `/${newName}`).replace(/\\/g, '/')

      return {
        original: filePath,
        originalName: fileName,
        newName,
        newPath
      }
    })
  }, [files, mode, sequenceStart, sequencePadding, dateFormat, findText, replaceText, caseSensitive, prefix, suffix, outputPath])

  const handleExecute = async () => {
    if (files.length === 0) {
      message.warning('请先选择文件')
      return
    }

    setIsProcessing(true)
    setProgress({ current: 0, total: files.length })

    try {
      const options: BatchRenameOptions = {
        mode,
        sequenceStart,
        sequencePadding,
        dateFormat,
        findText,
        replaceText,
        prefix,
        suffix,
        caseSensitive,
        outputPath: outputPath || getDefaultOutputPath(files) || undefined,
        conflictAction
      }

      const results: RenameResult[] = await window.electronAPI.batchRename(files, options)
      
      const successCount = results.filter(r => r.success).length
      message.success(`重命名完成：成功 ${successCount} 个，失败 ${results.length - successCount} 个`)
      
      onClose()
    } catch (error) {
      message.error('执行失败: ' + (error as Error).message)
    } finally {
      setIsProcessing(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="批量重命名"
      width={1000}
      styles={{ body: { padding: '16px', overflow: 'hidden' } }}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button 
            type="primary" 
            onClick={handleExecute}
            disabled={files.length === 0 || isProcessing}
            loading={isProcessing}
          >
            {isProcessing ? '处理中...' : '执行重命名'}
          </Button>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 16, height: '60vh' }}>
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <Card size="small" title="选择文件">
            <Button 
              icon={<FolderOpenOutlined />} 
              onClick={handleSelectFiles}
              block
              style={{ marginBottom: 8 }}
            >
              选择图片文件
            </Button>
            <Text type="secondary">已选择: {files.length} 个文件</Text>
          </Card>

          <Card size="small" title="重命名规则">
            <Radio.Group 
              value={mode} 
              onChange={e => setMode(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <Radio value="sequence">序号重命名</Radio>
              <Radio value="date">日期前缀</Radio>
              <Radio value="replace">查找替换</Radio>
              <Radio value="prefix">添加前缀</Radio>
              <Radio value="suffix">添加后缀</Radio>
            </Radio.Group>
          </Card>

          {mode === 'sequence' && (
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text>起始序号</Text>
                  <InputNumber 
                    value={sequenceStart} 
                    onChange={v => setSequenceStart(v || 1)} 
                    min={0} 
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <Text>序号位数</Text>
                  <InputNumber 
                    value={sequencePadding} 
                    onChange={v => setSequencePadding(v || 1)} 
                    min={1} 
                    max={10}
                    style={{ width: '100%' }}
                  />
                </div>
              </Space>
            </Card>
          )}

          {mode === 'date' && (
            <Card size="small">
              <Text>日期格式</Text>
              <Select 
                value={dateFormat} 
                onChange={setDateFormat}
                style={{ width: '100%' }}
              >
                <Select.Option value="YYYY-MM-DD">YYYY-MM-DD</Select.Option>
                <Select.Option value="YYYYMMDD">YYYYMMDD</Select.Option>
                <Select.Option value="MM-DD-YYYY">MM-DD-YYYY</Select.Option>
              </Select>
            </Card>
          )}

          {mode === 'replace' && (
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input 
                  placeholder="查找内容" 
                  value={findText} 
                  onChange={e => setFindText(e.target.value)} 
                />
                <Input 
                  placeholder="替换为" 
                  value={replaceText} 
                  onChange={e => setReplaceText(e.target.value)} 
                />
                <Checkbox 
                  checked={caseSensitive} 
                  onChange={e => setCaseSensitive(e.target.checked)}
                >
                  区分大小写
                </Checkbox>
              </Space>
            </Card>
          )}

          {mode === 'prefix' && (
            <Card size="small">
              <Input 
                placeholder="前缀内容" 
                value={prefix} 
                onChange={e => setPrefix(e.target.value)} 
              />
            </Card>
          )}

          {mode === 'suffix' && (
            <Card size="small">
              <Input 
                placeholder="后缀内容" 
                value={suffix} 
                onChange={e => setSuffix(e.target.value)} 
              />
            </Card>
          )}

          <Card size="small" title="冲突处理">
            <Radio.Group 
              value={conflictAction} 
              onChange={e => setConflictAction(e.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <Radio value="skip">跳过</Radio>
              <Radio value="overwrite">覆盖</Radio>
              <Radio value="rename">重命名</Radio>
            </Radio.Group>
          </Card>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text strong>预览效果 ({files.length} 个文件)</Text>
            <Button 
              type="link" 
              icon={<FolderOutlined />} 
              onClick={handleSelectOutputPath}
              style={{ padding: 0 }}
            >
              {displayOutputPath ? displayOutputPath.split(/[/\\]/).pop() : '选择输出目录'}
            </Button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 6 }}>
            <List
              size="small"
              dataSource={previewResults}
              renderItem={(item, index) => (
                <List.Item>
                  <Space>
                    <Text type="secondary">{index + 1}.</Text>
                    <Text style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.originalName}
                    </Text>
                    <ArrowRightOutlined />
                    <Text style={{ color: '#52c41a', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.newName}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
          {isProcessing && (
            <Progress 
              percent={Math.round((progress.current / progress.total) * 100)} 
              status="active" 
              style={{ marginTop: 8 }}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}

export default BatchRename
