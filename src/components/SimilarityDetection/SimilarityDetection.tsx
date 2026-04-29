import React, { useState, useEffect } from 'react'
import { Card, Button, Progress, Alert, Tag, Typography } from 'antd'
import { CameraOutlined, RadarChartOutlined, StopOutlined } from '@ant-design/icons'
import type { SimilarityScanConfig, SimilarityScanResult, SimilarityScanProgress } from '../../types'
import ScanConfig from './ScanConfig'
import ScanResults from './ScanResults'
import { PageSection } from '../UnifiedUI'
import './SimilarityDetection.css'

const { Paragraph } = Typography

const statusMeta: Record<SimilarityScanProgress['status'], { label: string; className: string }> = {
  scanning: { label: '正在扫描文件', className: 'is-scanning' },
  hashing: { label: '正在计算哈希', className: 'is-hashing' },
  comparing: { label: '正在比对相似项', className: 'is-comparing' },
  completed: { label: '扫描完成', className: 'is-completed' },
  error: { label: '扫描出错', className: 'is-error' },
}

const SimilarityDetection: React.FC = () => {
  const [config, setConfig] = useState<SimilarityScanConfig | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<SimilarityScanProgress | null>(null)
  const [result, setResult] = useState<SimilarityScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  

  useEffect(() => {
    if (!window.electronAPI) return

    const unsubscribe = window.electronAPI.onSimilarityScanProgress((progressData) => {
      setProgress(progressData)
      if (progressData.status === 'completed' || progressData.status === 'error') {
        setScanning(false)
      }
    })

    return unsubscribe
  }, [])

  const handleStartScan = async (scanConfig: SimilarityScanConfig) => {
    if (!window.electronAPI) {
      setError('Electron API 不可用')
      return
    }

    setConfig(scanConfig)
    setScanning(true)
    setProgress(null)
    setResult(null)
    setError(null)

    try {
      const scanResult = await window.electronAPI.scanSimilarImages(scanConfig)
      setResult(scanResult)
    } catch (err: any) {
      setError(err.message || '扫描失败')
    } finally {
      setScanning(false)
    }
  }

  const handleCancelScan = () => {
    window.electronAPI?.cancelSimilarityScan()
    setScanning(false)
    setProgress(null)
  }

  const handleReset = () => {
    setConfig(null)
    setScanning(false)
    setProgress(null)
    setResult(null)
    setError(null)
  }

  return (
    <div className="similarity-detection">
      <Card
        className="app-surface-card similarity-shell"
        title={
          <div className="similarity-shell__header">
            <div className="similarity-shell__title">
              <span className="similarity-shell__icon">
                <RadarChartOutlined />
              </span>
              <div>
                <div className="similarity-shell__heading">相似照片检测</div>
                <div className="similarity-shell__subheading">按统一工作面板流程扫描、比对和清理重复或相近照片</div>
              </div>
            </div>
            <Tag color="processing" bordered={false}>智能比对</Tag>
          </div>
        }
        variant="borderless"
      >
        <div className="similarity-page">
          <div className="similarity-intro">
            <span className="similarity-intro__badge">
              <CameraOutlined />
              照片去重工作流
            </span>
            <Paragraph className="similarity-intro__text">
              自动检测本地照片库中的重复或相似照片，帮助您清理冗余文件、确认推荐保留项，并在删除前统一预览分组结果。
            </Paragraph>
          </div>

          {error && (
            <Alert
              message="扫描错误"
              description={error}
              type="error"
              showIcon
              closable
              className="app-inline-notice similarity-alert"
              onClose={() => setError(null)}
            />
          )}

          {!config && !scanning && (
            <div className="similarity-state">
              <ScanConfig onStart={handleStartScan} />
            </div>
          )}

          {config && scanning && (
            <div className="similarity-state">
              <PageSection
                title="扫描进度"
                subtitle="正在分析目录中的图片哈希并比对相似项"
                extra={
                  <div className="similarity-progress__header-actions">
                    {progress?.status && (
                      <span className={`similarity-status-pill ${statusMeta[progress.status].className}`}>
                        {statusMeta[progress.status].label}
                      </span>
                    )}
                    <Button
                      icon={<StopOutlined />}
                      onClick={handleCancelScan}
                      danger
                    >
                      取消扫描
                    </Button>
                  </div>
                }
              >
                {progress && (
                  <div className="similarity-progress">
                    <Progress
                      percent={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
                      status={progress.status === 'error' ? 'exception' : 'active'}
                      format={() => `${progress.current} / ${progress.total}`}
                    />

                    <div className="similarity-progress__meta">
                      {progress.currentFile && (
                        <div className="similarity-progress__info">
                          <span className="similarity-progress__label">当前文件</span>
                          <span className="similarity-progress__path" title={progress.currentFile}>
                            {progress.currentFile}
                          </span>
                        </div>
                      )}

                      <div className="similarity-progress__summary">
                        <div className="similarity-progress__stat">
                          <span className="similarity-progress__label">处理进度</span>
                          <strong>{progress.current} / {progress.total}</strong>
                        </div>
                        <div className="similarity-progress__stat">
                          <span className="similarity-progress__label">已发现相似组</span>
                          <strong>{progress.groupsFound} 组</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </PageSection>
            </div>
          )}

          {result && !scanning && (
            <div className="similarity-state">
              <ScanResults
                result={result}
                config={config!}
                onReset={handleReset}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default SimilarityDetection

