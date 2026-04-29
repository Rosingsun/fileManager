import React, { useState } from 'react'
import { Form, Input, Button, Switch, Slider, Select, Space, InputNumber } from 'antd'
import { FolderOpenOutlined, EyeOutlined, FilterOutlined, SettingOutlined } from '@ant-design/icons'
import type { SimilarityScanConfig } from '../../types'
import FormPreview from '../../components/FormPreview'
import { PageSection } from '../UnifiedUI'

interface ScanConfigProps {
  onStart: (config: SimilarityScanConfig) => void
}

const ScanConfig: React.FC<ScanConfigProps> = ({ onStart }) => {
  const [form] = Form.useForm()
  const [scanPath, setScanPath] = useState<string>('')
  const [previewVisible, setPreviewVisible] = useState<boolean>(false)

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
      className="scan-config-form"
    >
      <div className="similarity-config">
        <PageSection
          title="扫描目录与过滤规则"
          subtitle="先选择照片目录，再设定要包含或排除的文件范围"
          extra={<span className="similarity-section-hint"><FolderOpenOutlined /> 照片范围</span>}
        >
          <Form.Item
            label="扫描路径"
            name="scanPath"
            rules={[{ required: true, message: '请选择扫描路径' }]}
            className="path-form-item"
          >
            <div className="similarity-path-picker">
              <Input
                placeholder="选择要扫描的文件夹"
                value={scanPath}
                readOnly
                onClick={handleSelectPath}
                className="path-input"
                prefix={<FolderOpenOutlined />}
              />
              <Button
                icon={<FolderOpenOutlined />}
                onClick={handleSelectPath}
                type="primary"
                className="select-path-btn"
              >
                选择文件夹
              </Button>
            </div>
          </Form.Item>

          <div className="similarity-config-grid">
            <div className="similarity-config-card">
              <div className="similarity-config-card__title">
                <FilterOutlined />
                文件过滤
              </div>

              <Form.Item
                label="包含子文件夹"
                name="includeSubdirectories"
                valuePropName="checked"
                className="include-subdirs-item"
              >
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>

              <div className="size-filters-row">
                <Form.Item label="最小文件大小 (KB)" name="minFileSize">
                  <InputNumber
                    min={0}
                    placeholder="跳过过小文件"
                    style={{ width: '100%' }}
                    className="size-input"
                  />
                </Form.Item>
                <Form.Item label="最大文件大小 (MB)" name="maxFileSize">
                  <InputNumber
                    min={0}
                    placeholder="跳过过大文件"
                    style={{ width: '100%' }}
                    className="size-input"
                  />
                </Form.Item>
              </div>

              <Form.Item label="排除的文件夹路径（每行一个）" name="excludedFolders">
                <Input.TextArea
                  rows={4}
                  placeholder="例如：&#10;D:\Photos\Backup&#10;D:\Photos\Archive"
                  className="text-area"
                />
              </Form.Item>

              <Form.Item label="排除的文件扩展名（逗号分隔）" name="excludedExtensions">
                <Input
                  placeholder="例如：.gif, .bmp, .tiff"
                  className="extension-input"
                />
              </Form.Item>
            </div>

            <div className="similarity-config-card">
              <div className="similarity-config-card__title">
                <SettingOutlined />
                检测策略
              </div>

              <Form.Item
                label="相似度阈值"
                name="similarityThreshold"
                help="严格模式：95-100% | 普通模式：85-95% | 宽松模式：75-85%"
              >
                <div className="slider-section">
                  <Slider
                    min={75}
                    max={100}
                    marks={{
                      75: '75%',
                      85: '85%',
                      95: '95%',
                      100: '100%'
                    }}
                    className="similarity-slider"
                  />
                  <div className="threshold-labels">
                    <span className="threshold-label">宽松</span>
                    <span className="threshold-label">普通</span>
                    <span className="threshold-label">严格</span>
                  </div>
                </div>
              </Form.Item>

              <Form.Item label="检测算法" name="algorithm">
                <Select className="algorithm-select">
                  <Select.Option value="hash" className="algorithm-option">
                    <div className="algorithm-option-content no-wrap">
                      <span className="algorithm-name">快速模式</span>
                      <span className="algorithm-desc">（仅文件哈希）</span>
                    </div>
                  </Select.Option>
                  <Select.Option value="phash" className="algorithm-option">
                    <div className="algorithm-option-content no-wrap">
                      <span className="algorithm-name">精确模式</span>
                      <span className="algorithm-desc">（仅感知哈希）</span>
                    </div>
                  </Select.Option>
                  <Select.Option value="both" className="algorithm-option">
                    <div className="algorithm-option-content no-wrap">
                      <span className="algorithm-name">混合模式</span>
                      <span className="algorithm-desc">（文件哈希 + 感知哈希）</span>
                    </div>
                  </Select.Option>
                </Select>
              </Form.Item>
            </div>
          </div>
        </PageSection>

        <div className="similarity-config__footer">
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            className="start-scan-btn"
          >
            开始扫描
          </Button>
          <Button
            type="default"
            size="large"
            icon={<EyeOutlined />}
            onClick={() => setPreviewVisible(true)}
          >
            预览配置
          </Button>
        </div>
      </div>

      <FormPreview
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        formInstance={form}
        title="相似照片检测配置预览"
      />
    </Form>
  )
}

export default ScanConfig

