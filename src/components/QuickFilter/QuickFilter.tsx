import React, { useEffect, useState } from 'react'
import { ThunderboltOutlined } from '@ant-design/icons'
import { AlertCircle, X } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import type {
  ImageQualityScanConfig,
  ImageQualityScanProgress,
  ImageQualityScanResult,
} from '../../types'
import { getElectronApiIssueMessage, logSignedInUserAction, waitForElectronApiReady } from '../../utils'
import QuickFilterWorkflowSteps from './QuickFilterWorkflowSteps'
import QuickFilterScanSetup from './QuickFilterScanSetup'
import QuickFilterScanProgress from './QuickFilterScanProgress'
import QuickFilterResultsView from './QuickFilterResultsView'
import { getActiveWorkflowStep } from './quickFilterShared'
import './quick-filter.css'

const QuickFilter: React.FC = () => {
  const [config, setConfig] = useState<ImageQualityScanConfig | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ImageQualityScanProgress | null>(null)
  const [result, setResult] = useState<ImageQualityScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiHint, setApiHint] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ok = await waitForElectronApiReady({ requiredMethod: 'scanImageQuality' })
      if (cancelled) return
      if (!ok) {
        setApiHint(getElectronApiIssueMessage('scanImageQuality') || 'Electron API 不可用')
      } else {
        setApiHint(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onImageQualityScanProgress) return
    const unsub = window.electronAPI.onImageQualityScanProgress((p) => {
      setProgress(p)
      if (p.status === 'completed' || p.status === 'error' || p.status === 'cancelled') {
        setScanning(false)
      }
    })
    return unsub
  }, [])

  const handleStartScan = async (scanConfig: ImageQualityScanConfig) => {
    const ready = await waitForElectronApiReady({ requiredMethod: 'scanImageQuality' })
    if (!ready || !window.electronAPI?.scanImageQuality) {
      setError(getElectronApiIssueMessage('scanImageQuality'))
      return
    }
    setConfig(scanConfig)
    setScanning(true)
    setProgress(null)
    setResult(null)
    setError(null)
    try {
      const scanResult = await window.electronAPI.scanImageQuality(scanConfig)
      setResult(scanResult)
      logSignedInUserAction(
        'image_quality_scan',
        `图片质量扫描完成（${scanResult.items?.length ?? 0} 项）`,
        scanConfig.scanPath
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '分析失败')
      setConfig(null)
    } finally {
      setScanning(false)
    }
  }

  const handleCancelScan = () => {
    window.electronAPI?.cancelImageQualityScan()
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
  const showProgress = Boolean(config && scanning)
  const showResults = Boolean(result && !scanning)

  return (
    <div className="quick-filter">
      <div className="qf-page">
        <header className="qf-hero">
          <div className="qf-hero__top">
            <div className="qf-hero__brand">
              <span className="qf-hero__icon" aria-hidden>
                <ThunderboltOutlined />
              </span>
              <div className="qf-hero__titles">
                <h1 className="qf-hero__title">快速筛选</h1>
                <p className="qf-hero__subtitle">曝光与对比度量化参考，构图启发式辅助审阅</p>
              </div>
            </div>
            <Badge variant="secondary" className="qf-hero__tag">
              质量辅助
            </Badge>
          </div>
          <QuickFilterWorkflowSteps current={workflowStep} />
        </header>

        <div className="qf-body">
          {apiHint && showSetup ? (
            <Alert variant="default" className="app-inline-notice qf-alert">
              <AlertCircle />
              <AlertTitle>无法使用快速筛选</AlertTitle>
              <AlertDescription>{apiHint}</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive" className="app-inline-notice qf-alert">
              <AlertCircle />
              <AlertTitle>分析错误</AlertTitle>
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

          {showSetup ? (
            <QuickFilterScanSetup apiHint={apiHint} onStart={(c) => void handleStartScan(c)} />
          ) : null}
          {showProgress ? (
            <QuickFilterScanProgress progress={progress} onCancel={handleCancelScan} />
          ) : null}
          {showResults && config && result ? (
            <QuickFilterResultsView
              result={result}
              config={config}
              onReset={handleReset}
              onResultChange={setResult}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default QuickFilter
