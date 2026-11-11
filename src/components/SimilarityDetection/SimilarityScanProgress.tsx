import React from 'react'
import { TbPlayerStop } from '../icons'
import { SimilarityButton } from './SimilarityButton'
import type { SimilarityScanProgress } from '../../types'
import CircularProgress from '../CircularProgress'
import { SCAN_STAGE_PIPELINE, statusMeta } from './similarityShared'

interface SimilarityScanProgressPanelProps {
  progress: SimilarityScanProgress | null
  onCancel: () => void
}

const STAGE_ORDER: SimilarityScanProgress['status'][] = [
  'scanning',
  'hashing',
  'comparing',
  'semantic',
]

function stageIndex(status: SimilarityScanProgress['status']): number {
  const idx = STAGE_ORDER.indexOf(status)
  return idx >= 0 ? idx : 0
}

const SimilarityScanProgressPanel: React.FC<SimilarityScanProgressPanelProps> = ({
  progress,
  onCancel,
}) => {
  // 比对/语义阶段使用后端上报的细粒度进度，其余阶段按已处理数量估算
  const percent =
    progress && progress.status !== 'scanning' && typeof progress.stagePercent === 'number'
      ? Math.max(0, Math.min(100, Math.round(progress.stagePercent)))
      : progress && progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0
  const activeStage = progress?.status ?? 'scanning'
  const activeIdx =
    activeStage === 'completed' ? SCAN_STAGE_PIPELINE.length : stageIndex(activeStage)

  return (
    <section className="sim-scan" aria-live="polite">
      <div className="sim-scan__ring-wrap">
        <CircularProgress
          progress={percent}
          size={96}
          strokeWidth={7}
          color="var(--app-primary)"
          backgroundColor="color-mix(in srgb, var(--app-text-tertiary) 15%, transparent)"
        />
      </div>
      <p className="sim-scan__status">
        {progress ? statusMeta[progress.status].label : '准备开始…'}
      </p>

      <div className="sim-scan__pipeline" role="list">
        {SCAN_STAGE_PIPELINE.map((stage, index) => (
          <span
            key={stage.status}
            role="listitem"
            className={`sim-scan__stage ${
              index < activeIdx ? 'is-done' : index === activeIdx ? 'is-active' : ''
            }`}
          >
            {stage.label}
          </span>
        ))}
      </div>

      {progress?.currentFile ? (
        <div className="sim-scan__file" title={progress.currentFile}>
          {progress.currentFile}
        </div>
      ) : null}

      {progress ? (
        <div className="sim-scan__metrics">
          <div className="sim-scan__metric">
            <span className="sim-scan__metric-value">
              {progress.current}/{progress.total}
            </span>
            <span className="sim-scan__metric-label">已处理</span>
          </div>
          <div className="sim-scan__metric">
            <span className="sim-scan__metric-value">{progress.groupsFound}</span>
            <span className="sim-scan__metric-label">相似组</span>
          </div>
        </div>
      ) : null}

      <div className="sim-scan__actions">
        <SimilarityButton
          variant="danger"
          size="md"
          icon={<TbPlayerStop size={16} />}
          onClick={onCancel}
        >
          取消扫描
        </SimilarityButton>
      </div>
    </section>
  )
}

export default SimilarityScanProgressPanel
