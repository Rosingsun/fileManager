import React, { useState, useEffect } from 'react'
import { RadarChartOutlined } from '@ant-design/icons'
import { AlertCircle, X } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import type { SimilarityScanConfig, SimilarityScanResult, SimilarityScanProgress } from '../../types'
import { logSignedInUserAction } from '../../utils'
import SimilarityWorkflowSteps from './SimilarityWorkflowSteps'
import SimilarityScanSetup from './SimilarityScanSetup'
import SimilarityScanProgressPanel from './SimilarityScanProgress'
import SimilarityResultsView from './SimilarityResultsView'
import { getActiveWorkflowStep } from './similarityShared'
import './similarity.css'

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
      logSignedInUserAction(
        'similarity_scan',
        `相似照片扫描完成（${scanResult.groups?.length ?? 0} 组）`,
        scanConfig.scanPath
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '扫描失败')
      setConfig(null)
    } finally {
      setScanning(false)
    }
  }

  const handleCancelScan = () => {
    window.electronAPI?.cancelSimilarityScan()
    setScanning(false)
    setProgress(null)
    setConfig(null)
  }

  const handleReset = () => {
    setConfig(null)
    setScanning(false)
    setProgress(null)
    setResult(null)
    setError(null)
  }

  const workflowStep = getActiveWorkflowStep(config, scanning, !!result)
  const showSetup = !config && !scanning && !result
  const showProgress = config && scanning
  const showResults = result && !scanning

  return (
    <div className="similarity-detection">
      <div className="similarity-page">
        <header className="sim-hero">
          <div className="sim-hero__top">
            <div className="sim-hero__brand">
              <span className="sim-hero__icon" aria-hidden>
                <RadarChartOutlined />
              </span>
              <div className="sim-hero__titles">
                <h1 className="sim-hero__title">相似照片检测</h1>
                <p className="sim-hero__subtitle">发现重复与相近照片，审阅后释放空间</p>
              </div>
            </div>
            <Badge variant="secondary" className="sim-hero__tag">
              智能比对
            </Badge>
          </div>
          <SimilarityWorkflowSteps current={workflowStep} />
        </header>

        <div className="sim-body">
          {error ? (
            <Alert variant="destructive" className="app-inline-notice sim-alert">
              <AlertCircle />
              <AlertTitle>扫描错误</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="关闭"
                  onClick={() => setError(null)}
                >
                  <X />
                </Button>
              </AlertAction>
            </Alert>
          ) : null}

          {showSetup ? <SimilarityScanSetup onStart={handleStartScan} /> : null}
          {showProgress ? (
            <SimilarityScanProgressPanel progress={progress} onCancel={handleCancelScan} />
          ) : null}
          {showResults && config ? (
            <SimilarityResultsView result={result} config={config} onReset={handleReset} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default SimilarityDetection
