import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Progress, Spin, Typography } from 'antd'
import { GlassCard } from './UnifiedUI'
import { CloudOutlined, ReloadOutlined } from '@ant-design/icons'
import { AuthApiError, cosImageStats, formatAuthApiError, formatFileSize, type CosImageStats } from '../utils'

export interface CosLibrarySummaryCardProps {
  onOpen: () => void
  refreshNonce?: number
}

const CosLibrarySummaryCard: React.FC<CosLibrarySummaryCardProps> = ({ onOpen, refreshNonce = 0 }) => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [cosDisabled, setCosDisabled] = useState(false)
  const [stats, setStats] = useState<CosImageStats | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await cosImageStats()
      setStats(data)
      setCosDisabled(false)
    } catch (e: unknown) {
      if (e instanceof AuthApiError && e.code === 'COS_NOT_CONFIGURED') {
        setCosDisabled(true)
        setStats(null)
      } else {
        message.error(formatAuthApiError(e))
        setStats(null)
      }
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats, refreshNonce])

  const storagePercent = useMemo(() => {
    if (!stats?.quotaBytes) return 0
    return Math.min(100, Math.round((stats.totalBytes / stats.quotaBytes) * 100))
  }, [stats])

  if (cosDisabled) {
    return (
      <GlassCard size="small" className="cos-library-summary-card cos-library-summary-card--compact" title="云图库">
        <Typography.Text type="secondary" className="cos-library-summary-card__hint">
          未配置对象存储
        </Typography.Text>
      </GlassCard>
    )
  }

  return (
    <GlassCard
      size="small"
      className="cos-library-summary-card cos-library-summary-card--compact"
      style={{ cursor: loading ? 'default' : 'pointer' }}
      title={
        <span className="cos-library-summary-card__title">
          <CloudOutlined />
          云图库
        </span>
      }
      extra={
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          aria-label="刷新统计"
          onClick={(e) => {
            e.stopPropagation()
            void fetchStats()
          }}
          loading={loading}
        />
      }
      onClick={() => {
        if (!loading) onOpen()
      }}
    >
      {loading && !stats ? (
        <div className="cos-library-summary-card__loading">
          <Spin size="small" />
        </div>
      ) : (
        <div className="cos-library-summary-card__body" title="点击进入云图库">
          <div className="cos-library-summary-card__stats">
            <span>
              <Typography.Text strong>{stats?.imageCount ?? 0}</Typography.Text>
              <Typography.Text type="secondary"> 张</Typography.Text>
            </span>
            <Typography.Text type="secondary" className="cos-library-summary-card__sep">
              ·
            </Typography.Text>
            <Typography.Text strong>{formatFileSize(stats?.totalBytes ?? 0)}</Typography.Text>
          </div>
          <div className="cos-library-summary-card__quota">
            <Progress
              percent={storagePercent}
              showInfo={false}
              size="small"
              strokeColor={storagePercent >= 90 ? 'var(--app-danger, #ff3b30)' : 'var(--app-primary, #0a84ff)'}
              trailColor="var(--app-border-subtle, rgba(0,0,0,0.06))"
            />
            <Typography.Text type="secondary" className="cos-library-summary-card__quota-label">
              <Typography.Text strong>{formatFileSize(stats?.totalBytes ?? 0)}</Typography.Text>
              {' / '}
              <Typography.Text strong>{formatFileSize(stats?.quotaBytes ?? 0)}</Typography.Text>
            </Typography.Text>
          </div>
        </div>
      )}
    </GlassCard>
  )
}

export default CosLibrarySummaryCard
