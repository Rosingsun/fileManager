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
      <Card>
        <Title level={3}>相似照片检测</Title>
        <p style={{ color: '#666', marginBottom: 24 }}>
          自动检测本地照片库中的重复或相似照片，帮助您清理冗余文件，节省存储空间。
        </p>

        {error && (
          <Alert
            message="扫描错误"
            description={error}
            type="error"
            showIcon
            closable
            style={{ marginBottom: 16 }}
            onClose={() => setError(null)}
          />
        )}

        {!config && !scanning && (
          <ScanConfig onStart={handleStartScan} />
        )}

        {config && scanning && (
          <div className="scan-progress">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Space>
                  <span>扫描状态：</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {progress?.status === 'scanning' && '正在扫描文件...'}
                    {progress?.status === 'hashing' && '正在计算哈希值...'}
                    {progress?.status === 'comparing' && '正在对比相似照片...'}
                    {progress?.status === 'completed' && '扫描完成'}
                    {progress?.status === 'error' && '扫描出错'}
                  </span>
                </Space>
              </div>

              {progress && (
                <>
                  <Progress
                    percent={progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}
                    status={progress.status === 'error' ? 'exception' : 'active'}
                    format={(percent) => `${progress.current} / ${progress.total}`}
                  />
                  {progress.currentFile && (
                    <div style={{ fontSize: 12, color: '#999', wordBreak: 'break-all' }}>
                      当前文件: {progress.currentFile}
                    </div>
                  )}
                  {progress.groupsFound > 0 && (
                    <div style={{ fontSize: 14, color: '#1890ff' }}>
                      已发现 {progress.groupsFound} 组相似照片
                    </div>
                  )}
                </>
              )}

              <Button
                icon={<StopOutlined />}
                onClick={handleCancelScan}
                danger
              >
                取消扫描
              </Button>
            </Space>
          </div>
        )}

        {result && !scanning && (
          <>
            <Divider />
            <ScanResults
              result={result}
              config={config!}
              onReset={handleReset}
            />
          </>
        )}
      </Card>
    </div>
  )
}

export default SimilarityDetection

