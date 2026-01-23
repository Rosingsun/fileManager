import React, { useState } from 'react'
import { Form, Input, Button, Switch, Slider, Select, Space, Card, Divider, InputNumber } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'
import type { SimilarityScanConfig } from '../../types'

interface ScanConfigProps {
  onStart: (config: SimilarityScanConfig) => void
}

const ScanConfig: React.FC<ScanConfigProps> = ({ onStart }) => {
  const [form] = Form.useForm()
  const [scanPath, setScanPath] = useState<string>('')

  const handleSelectPath = async () => {
    if (!window.electronAPI) return

    const path = await window.electronAPI.openDirectory()
    if (path) {
      setScanPath(path)
      form.setFieldsValue({ scanPath: path })
    }
  }

  const handleSubmit = (values: any) => {
    const config: SimilarityScanConfig = {
      scanPath: values.scanPath || scanPath,
      includeSubdirectories: values.includeSubdirectories ?? true,
      minFileSize: values.minFileSize ? values.minFileSize * 1024 : undefined, // KB转字节
      maxFileSize: values.maxFileSize ? values.maxFileSize * 1024 * 1024 : undefined, // MB转字节
      excludedFolders: values.excludedFolders ? values.excludedFolders.split('\n').filter((f: string) => f.trim()) : [],
      excludedExtensions: values.excludedExtensions ? values.excludedExtensions.split(',').map((e: string) => e.trim().replace('.', '')) : [],
      similarityThreshold: values.similarityThreshold || 90,
      algorithm: values.algorithm || 'both'
    }

    onStart(config)
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        includeSubdirectories: true,
        similarityThreshold: 90,
        algorithm: 'both'
      }}
    >
      <Form.Item
        label="扫描路径"
        name="scanPath"
        rules={[{ required: true, message: '请选择扫描路径' }]}
      >
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="选择要扫描的文件夹"
            value={scanPath}
            readOnly
            onClick={handleSelectPath}
          />
          <Button
            icon={<FolderOpenOutlined />}
            onClick={handleSelectPath}
          >
            选择文件夹
          </Button>
        </Space.Compact>
      </Form.Item>

      <Form.Item
        label="扫描选项"
        name="includeSubdirectories"
        valuePropName="checked"
      >
        <Switch checkedChildren="包含子文件夹" unCheckedChildren="仅当前文件夹" />
      </Form.Item>

      <Card size="small" title="文件过滤" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form.Item
            label="最小文件大小 (KB)"
            name="minFileSize"
          >
            <InputNumber
              min={0}
              placeholder="跳过小于此大小的文件"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="最大文件大小 (MB)"
            name="maxFileSize"
          >
            <InputNumber
              min={0}
              placeholder="跳过大于此大小的文件"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="排除的文件夹路径（每行一个）"
            name="excludedFolders"
          >
            <Input.TextArea
              rows={3}
              placeholder="例如：&#10;D:\Photos\Backup&#10;D:\Photos\Archive"
            />
          </Form.Item>

          <Form.Item
            label="排除的文件扩展名（逗号分隔）"
            name="excludedExtensions"
          >
            <Input
              placeholder="例如：.gif, .bmp, .tiff"
            />
          </Form.Item>
        </Space>
      </Card>

      <Card size="small" title="检测设置" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form.Item
            label="相似度阈值"
            name="similarityThreshold"
            help="严格模式：95-100% | 普通模式：85-95% | 宽松模式：75-85%"
          >
            <Slider
              min={75}
              max={100}
              marks={{
                75: '75%',
                85: '85%',
                95: '95%',
                100: '100%'
              }}
            />
          </Form.Item>

          <Form.Item
            label="检测算法"
            name="algorithm"
          >
            <Select>
              <Select.Option value="hash">快速模式（仅文件哈希）</Select.Option>
              <Select.Option value="phash">精确模式（仅感知哈希）</Select.Option>
              <Select.Option value="both">混合模式（文件哈希 + 感知哈希）</Select.Option>
            </Select>
          </Form.Item>
        </Space>
      </Card>

      <Form.Item>
        <Button type="primary" htmlType="submit" size="large" block>
          开始扫描
        </Button>
      </Form.Item>
    </Form>
  )
}

export default ScanConfig

