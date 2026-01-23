import React, { useState, useEffect } from 'react'
import { Card, Button, Progress, Alert, Space, Typography, Divider } from 'antd'
import { StopOutlined, ReloadOutlined } from '@ant-design/icons'
import type { SimilarityScanConfig, SimilarityScanResult, SimilarityScanProgress } from '../../types'
import ScanConfig from './ScanConfig'
import ScanResults from './ScanResults'
import './SimilarityDetection.css'

const { Title } = Typography

const SimilarityDetection: React.FC = () => {
  const [config, setConfig] = useState<SimilarityScanConfig | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<SimilarityScanProgress | null>(null)
  const [result, setResult] = useState<SimilarityScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 监听扫描进度
  useEffect(() => {
    if (!window.electronAPI) return

    const unsubscribe = window.electronAPI.onSimilarityScanProgress((progressData) => {
      setProgress(progressData)
      if (progressData.status === 'completed' || progressData.status === 'error') {
        setScanning(false)
      }
    })

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
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
      setScanning(false)
    } catch (err: any) {
      setError(err.message || '扫描失败')
      setScanning(false)
    }
  }

  const handleCancelScan = () => {
    if (window.electronAPI) {
      window.electronAPI.cancelSimilarityScan()
    }
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
      <Card className="main-card" variant="borderless">
        <div className="header-section">
          <Title level={3} className="main-title">相似照片检测</Title>
          <p className="description">
            自动检测本地照片库中的重复或相似照片，帮助您清理冗余文件，节省存储空间。
          </p>
        </div>

        {error && (
          <Alert
            message="扫描错误"
            description={error}
            type="error"
            showIcon
            closable
            className="error-alert"
            onClose={() => setError(null)}
          />
        )}

        {!config && !scanning && (
          <div className="config-section">
            <ScanConfig onStart={handleStartScan} />
          </div>
        )}

        {config && scanning && (
          <div className="scan-progress">
            <div className="progress-card">
              <div className="progress-header">
                <h4>扫描中</h4>
                <span className="status-indicator">
                  {progress?.status === 'scanning' && <span className="status-text scanning">正在扫描文件...</span>}
                  {progress?.status === 'hashing' && <span className="status-text hashing">正在计算哈希值...</span>}
                  {progress?.status === 'comparing' && <span className="status-text comparing">正在对比相似照片...</span>}
                  {progress?.status === 'completed' && <span className="status-text completed">扫描完成</span>}
                  {progress?.status === 'error' && <span className="status-text error">扫描出错</span>}
                </span>
              </div>

              {progress && (
                <div className="progress-content">
                  <div className="progress-bar-wrapper">
                    <Progress
                      percent={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
                      status={progress.status === 'error' ? 'exception' : 'active'}
                      format={(percent) => `${progress.current} / ${progress.total}`}
                      className="main-progress-bar"
                    />
                  </div>
                  
                  {progress.currentFile && (
                    <div className="current-file-info">
                      <span className="label">当前文件:</span>
                      <span className="file-path" title={progress.currentFile}>{progress.currentFile}</span>
                    </div>
                  )}
                  
                  {progress.groupsFound > 0 && (
                    <div className="groups-found">
                      <span className="label">已发现相似照片:</span>
                      <span className="group-count">{progress.groupsFound} 组</span>
                    </div>
                  )}
                </div>
              )}

              <div className="progress-footer">
                <Button
                  icon={<StopOutlined />}
                  onClick={handleCancelScan}
                  danger
                  size="large"
                  className="cancel-button"
                >
                  取消扫描
                </Button>
              </div>
            </div>
          </div>
        )}

        {result && !scanning && (
          <div className="results-section">
            <ScanResults
              result={result}
              config={config!}
              onReset={handleReset}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

export default SimilarityDetection

