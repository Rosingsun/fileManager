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
  Modal
} from 'antd'
import {
  FolderOpenOutlined,
  PlayCircleOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { useFileStore } from '../stores/fileStore'
import { useFileSystem } from '../hooks/useFileSystem'
import { generatePreview } from '../utils/organizer'
import type { OrganizeRule, OrganizeConfig } from '../types'

const { Option } = Select

const ControlPanel: React.FC = () => {
  const {
    currentPath,
    fileList,
    organizeConfig,
    setOrganizeConfig,
    previewResults,
    setPreviewResults
  } = useFileStore()
  
  const { selectDirectory, loadDirectory } = useFileSystem()
  
  const [ruleType, setRuleType] = useState<OrganizeRule['type']>('extension')
  const [dateFormat, setDateFormat] = useState<'year' | 'month' | 'day'>('month')
  const [customPattern, setCustomPattern] = useState('')
  const [includeSubdirs, setIncludeSubdirs] = useState(false)
  const [conflictAction, setConflictAction] = useState<'skip' | 'overwrite' | 'rename'>('rename')
  const [previewVisible, setPreviewVisible] = useState(false)

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
      const results = await generatePreview(fileList, config)
      setPreviewResults(results)
      setPreviewVisible(true)
    } catch (error: any) {
      message.error(`预览失败: ${error.message}`)
    }
  }

  return (
    <Card title="整理控制面板" style={{ height: '100%' }}>
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
        
        {currentPath && (
          <div style={{ fontSize: 12, color: '#666', wordBreak: 'break-all' }}>
            当前目录: {currentPath}
          </div>
        )}

        <Divider />

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
              onChange={(e) => setDateFormat(e.target.value)}
              style={{ width: '100%' }}
            >
              <Radio value="year">按年</Radio>
              <Radio value="month">按月</Radio>
              <Radio value="day">按日</Radio>
            </Radio.Group>
          </div>
        )}

        {/* 自定义规则输入 */}
        {ruleType === 'custom' && (
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>正则表达式：</div>
            <Input
              placeholder="例如: ^(.+?)_(.+?)\\..+$ (匹配第一个下划线前的内容)"
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value)}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              使用捕获组 ( ) 来提取分类名称
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
                onChange={(e) => setConflictAction(e.target.value)}
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

      {/* 预览模态框 */}
      <Modal
        title="整理预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <div style={{ maxHeight: 500, overflow: 'auto' }}>
          {previewResults.map((result, index) => (
            <div key={index} style={{ marginBottom: 8, fontSize: 12 }}>
              <div style={{ color: '#666' }}>从: {result.from}</div>
              <div style={{ color: '#1890ff' }}>到: {result.to}</div>
              {index < previewResults.length - 1 && <Divider style={{ margin: '8px 0' }} />}
            </div>
          ))}
        </div>
      </Modal>
    </Card>
  )
}

export default ControlPanel

