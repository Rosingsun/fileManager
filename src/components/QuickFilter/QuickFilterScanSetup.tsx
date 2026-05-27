import React, { useState } from 'react'
import { Form, Input, Switch, Slider, Collapse, InputNumber, Row, Col, Tooltip } from 'antd'
import { FolderOutlined } from '@ant-design/icons'
import { TbFolderOpen, TbPlayerPlay } from '../icons'
import { QuickFilterButton } from './QuickFilterButton'
import type { ImageQualityScanConfig } from '../../types'
import {
  buildImageQualityConfig,
  getPresetFormFields,
  QUICK_FILTER_FORM_INITIAL,
  SENSITIVITY_PRESETS,
  type SensitivityPresetId,
} from './quickFilterShared'
import { getElectronApiIssueMessage, waitForElectronApiReady } from '../../utils'

interface QuickFilterScanSetupProps {
  apiHint: string | null
  onStart: (config: ImageQualityScanConfig) => void
}

const QuickFilterScanSetup: React.FC<QuickFilterScanSetupProps> = ({ apiHint, onStart }) => {
  const [form] = Form.useForm()
  const [scanPath, setScanPath] = useState('')
  const preset = (Form.useWatch('sensitivityPreset', form) ?? 'recommended') as SensitivityPresetId

  const handleSelectPath = async () => {
    const ready = await waitForElectronApiReady({ requiredMethod: 'openDirectory' })
    if (!ready || !window.electronAPI) return
    const path = await window.electronAPI.openDirectory()
    if (path) {
      setScanPath(path)
      form.setFieldsValue({ scanPath: path })
    }
  }

  const applyPreset = (id: SensitivityPresetId) => {
    form.setFieldsValue({
      sensitivityPreset: id,
      ...getPresetFormFields(id),
    })
  }

  const handleSubmit = (values: Record<string, unknown>) => {
    onStart(buildImageQualityConfig(values))
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={QUICK_FILTER_FORM_INITIAL}
      className="qf-setup"
    >
      <Form.Item name="scanPath" rules={[{ required: true, message: '请选择目录' }]} hidden>
        <Input />
      </Form.Item>
      <Form.Item name="sensitivityPreset" hidden>
        <Input />
      </Form.Item>

      {apiHint ? (
        <p className="qf-intro" role="alert">
          {getElectronApiIssueMessage('scanImageQuality') || apiHint}
        </p>
      ) : (
        <p className="qf-intro">
          基于缩略分析分辨率的亮度与梯度分布，批量标记可能过曝、欠曝、低对比度及构图相关提示。结果不代表审美结论。
        </p>
      )}

      <div className="qf-setup-grid">
        <section className="qf-panel qf-panel--directory">
          <div className="qf-panel__head">
            <div className="qf-panel__title-row">
              <h2 className="qf-panel__title">照片目录</h2>
              <Form.Item
                className="qf-panel__subdirs"
                label="包含子文件夹"
                name="includeSubdirectories"
                valuePropName="checked"
              >
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </div>
            <p className="qf-panel__sub">选择要分析的本地文件夹</p>
          </div>
          <div
            className={`qf-path ${scanPath ? 'is-filled' : ''}`}
            role={scanPath ? undefined : 'button'}
            tabIndex={scanPath ? undefined : 0}
            onClick={!scanPath ? () => void handleSelectPath() : undefined}
            onKeyDown={(e) => {
              if (!scanPath && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                void handleSelectPath()
              }
            }}
          >
            {!scanPath ? (
              <>
                <span className="qf-path__ring">
                  <FolderOutlined />
                </span>
                <p className="qf-path__title">点击选择文件夹</p>
                <p className="qf-path__hint">支持子目录扫描，下方可展开过滤与排除规则</p>
              </>
            ) : (
              <>
                <code className="qf-path__code">{scanPath}</code>
                <div className="qf-path__actions">
                  <QuickFilterButton
                    variant="secondary"
                    size="md"
                    icon={<TbFolderOpen size={16} />}
                    onClick={() => void handleSelectPath()}
                  >
                    更换目录
                  </QuickFilterButton>
                </div>
              </>
            )}
          </div>

          <div className="qf-filters">
            <Collapse
              className="qf-advanced qf-filters__collapse"
              bordered={false}
              items={[
                {
                  key: 'filters',
                  label: '高级过滤',
                  children: (
                    <div className="qf-filters__body">
                      <div className="qf-filters__grid">
                        <Form.Item label="最小 (KB)" name="minFileSizeKb">
                          <InputNumber min={0} placeholder="不限" />
                        </Form.Item>
                        <Form.Item label="最大 (MB)" name="maxFileSizeMb">
                          <InputNumber min={0} placeholder="不限" />
                        </Form.Item>
                        <Form.Item label="分析长边" name="analysisLongEdge">
                          <InputNumber min={256} max={1024} addonAfter="px" />
                        </Form.Item>
                        <Form.Item label="并行数" name="maxConcurrent">
                          <InputNumber min={1} max={8} />
                        </Form.Item>
                      </div>
                      <Form.Item
                        className="qf-filters__exclude"
                        label="排除目录"
                        name="excludedFolders"
                        tooltip="每行一个路径，可选"
                      >
                        <Input.TextArea rows={2} placeholder="可选" />
                      </Form.Item>
                      <Form.Item
                        className="qf-filters__exclude"
                        label="排除扩展名"
                        name="excludedExtensions"
                        tooltip="逗号分隔，不含点"
                      >
                        <Input placeholder="raw, tif" />
                      </Form.Item>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </section>

        <section className="qf-panel">
          <div className="qf-panel__head">
            <h2 className="qf-panel__title">分析策略</h2>
            <p className="qf-panel__sub">敏感度预设与画质检测阈值，均为启发式参考</p>
          </div>

          <div className="qf-presets" role="group" aria-label="敏感度预设">
            {SENSITIVITY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`qf-preset ${preset === p.id ? 'is-active' : ''}`}
                onClick={() => applyPreset(p.id)}
              >
                <span className="qf-preset__label">{p.label}</span>
                <span className="qf-preset__hint">{p.hint}</span>
              </button>
            ))}
          </div>

          <div className="qf-thresholds-section">
            <h3 className="qf-thresholds-section__title">画质检测</h3>
            <Row gutter={[10, 8]} className="qf-quality-row">
              <Col xs={24} sm={8}>
                <Form.Item
                  className="qf-slider-item"
                  label={
                    <Tooltip title="拉普拉斯清晰度均值低于此值则提示可能模糊">
                      <span>清晰度下限</span>
                    </Tooltip>
                  }
                  name="minSharpnessLapMean"
                >
                  <Slider min={5} max={18} tooltip={{ formatter: (v) => String(v) }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  className="qf-slider-item"
                  label={
                    <Tooltip title="局部亮度波动估计高于此值则提示噪点偏多">
                      <span>噪点上限</span>
                    </Tooltip>
                  }
                  name="maxNoiseLevel"
                >
                  <Slider min={8} max={24} tooltip={{ formatter: (v) => String(v) }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  className="qf-slider-item"
                  label={
                    <Tooltip title="RGB 通道偏离灰度均值的比例高于此值则提示色偏">
                      <span>色偏上限 (%)</span>
                    </Tooltip>
                  }
                  name="maxColorCastScore"
                >
                  <Slider min={8} max={25} tooltip={{ formatter: (v) => `${v}%` }} />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <Collapse
            className="qf-advanced qf-thresholds"
            bordered={false}
            defaultActiveKey={[]}
            items={[
              {
                key: 'thresholds',
                label: '曝光 / 对比 / 构图',
                children: (
                  <Row gutter={[16, 12]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        className="qf-slider-item"
                        label={
                          <Tooltip title="高光区域（亮度≥250）像素占比超过此值则提示可能过曝">
                            <span>高光裁剪 ≥ (%)</span>
                          </Tooltip>
                        }
                        name="highlightClipRatio"
                      >
                        <Slider min={1} max={30} tooltip={{ formatter: (v) => `${v}%` }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        className="qf-slider-item"
                        label={
                          <Tooltip title="暗部（亮度≤5）像素占比超过此值则提示可能欠曝">
                            <span>阴影裁剪 ≥ (%)</span>
                          </Tooltip>
                        }
                        name="shadowClipRatio"
                      >
                        <Slider min={1} max={30} tooltip={{ formatter: (v) => `${v}%` }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        className="qf-slider-item"
                        label={
                          <Tooltip title="全图亮度标准差低于此值则提示低对比（发灰）">
                            <span>低对比阈值（标准差≤）</span>
                          </Tooltip>
                        }
                        name="lowContrastStd"
                      >
                        <Slider min={4} max={40} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        className="qf-slider-item"
                        label={
                          <Tooltip title="平均亮度高于此值时辅助判断过曝">
                            <span>辅助过曝（均值≥）</span>
                          </Tooltip>
                        }
                        name="overexposedMeanLuma"
                      >
                        <Slider min={160} max={250} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        className="qf-slider-item"
                        label={
                          <Tooltip title="平均亮度低于此值时辅助判断欠曝">
                            <span>辅助欠曝（均值≤）</span>
                          </Tooltip>
                        }
                        name="underexposedMeanLuma"
                      >
                        <Slider min={10} max={80} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        className="qf-slider-item"
                        label={
                          <Tooltip title="中心九宫格内梯度能量占比，超过则提示主体可能过于居中">
                            <span>中心能量 ≥ (%)</span>
                          </Tooltip>
                        }
                        name="compositionCenterEnergyRatio"
                      >
                        <Slider min={35} max={80} tooltip={{ formatter: (v) => `${v}%` }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        className="qf-slider-item"
                        label={
                          <Tooltip title="视觉重心到最近三分点的归一化距离，超过则提示偏离三分区">
                            <span>偏离三分区 ≥ (%)</span>
                          </Tooltip>
                        }
                        name="compositionCentroidOffThirdsMin"
                      >
                        <Slider min={10} max={45} tooltip={{ formatter: (v) => `${v}%` }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        className="qf-slider-item"
                        label={
                          <Tooltip title="重心距画面边缘归一化距离小于此比例则提示贴近边缘">
                            <span>贴边判定（距边≤ %）</span>
                          </Tooltip>
                        }
                        name="compositionNearEdge"
                      >
                        <Slider min={4} max={20} tooltip={{ formatter: (v) => `${v}%` }} />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
            ]}
          />
        </section>
      </div>

      <div className="qf-setup-bar">
        <div className="qf-setup-bar__row">
          <QuickFilterButton
            type="submit"
            variant="primary"
            size="lg"
            icon={<TbPlayerPlay size={17} />}
            disabled={!scanPath || Boolean(apiHint)}
          >
            开始分析
          </QuickFilterButton>
        </div>
        <p className="qf-setup-bar__note">
          曝光、对比、构图与画质检测均为算法启发式，不代表审美结论，请结合人工判断
        </p>
      </div>
    </Form>
  )
}

export default QuickFilterScanSetup
