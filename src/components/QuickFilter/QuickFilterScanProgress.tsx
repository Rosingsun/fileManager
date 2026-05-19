import React from 'react'
import { StopOutlined } from '@ant-design/icons'
import { Button } from '../ui/button'
import type { ImageQualityScanProgress } from '../../types'
import CircularProgress from '../CircularProgress'
import { SCAN_STAGE_PIPELINE, statusMeta } from './quickFilterShared'

interface QuickFilterScanProgressProps {
  progress: ImageQualityScanProgress | null
  onCancel: () => void
}

const STAGE_ORDER: ImageQualityScanProgress['status'][] = ['scanning', 'analyzing']

function stageIndex(status: ImageQualityScanProgress['status']): number {
  const idx = STAGE_ORDER.indexOf(status)
  return idx >= 0 ? idx : 0
}

const QuickFilterScanProgress: React.FC<QuickFilterScanProgressProps> = ({ progress, onCancel }) => {
  const percent =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const activeStage = progress?.status ?? 'scanning'
  const activeIdx = stageIndex(activeStage)

  const statusLabel =
    progress?.status === 'analyzing' && progress.currentFile
      ? progress.currentFile
      : progress
        ? statusMeta[progress.status].label
        : '准备开始…'

  return (
    <section className="qf-scan" aria-live="polite">
      <div className="qf-scan__ring-wrap">
        <CircularProgress
          progress={percent}
          size={96}
          strokeWidth={7}
          color="var(--app-warning)"
          backgroundColor="color-mix(in srgb, var(--app-text-tertiary) 15%, transparent)"
        />
      </div>
      <p className="qf-scan__status">{statusLabel}</p>

      <div className="qf-scan__pipeline" role="list">
        {SCAN_STAGE_PIPELINE.map((stage, index) => (
          <span
            key={stage.status}
            role="listitem"
            className={`qf-scan__stage ${
              index < activeIdx ? 'is-done' : index === activeIdx ? 'is-active' : ''
            }`}
          >
            {stage.label}
          </span>
        ))}
      </div>

      {progress ? (
        <div className="qf-scan__metrics">
          <div className="qf-scan__metric">
            <span className="qf-scan__metric-value">
              {progress.current}/{progress.total}
            </span>
            <span className="qf-scan__metric-label">已处理</span>
          </div>
          <div className="qf-scan__metric">
            <span className="qf-scan__metric-value">{progress.current}</span>
            <span className="qf-scan__metric-label">已分析</span>
          </div>
        </div>
      ) : null}

      <Button type="button" variant="destructive" size="sm" onClick={onCancel}>
        <StopOutlined />
        取消分析
      </Button>
    </section>
  )
}

export default QuickFilterScanProgress
