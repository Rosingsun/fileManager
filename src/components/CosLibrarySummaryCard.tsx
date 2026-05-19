import React, { useCallback, useEffect, useState } from 'react'
import { App, Button, Spin, Typography } from 'antd'
import { GlassCard } from './UnifiedUI'
import { CloudOutlined, ReloadOutlined } from '@ant-design/icons'
import { AuthApiError, cosImageStats, formatAuthApiError, formatFileSize } from '../utils'

export interface CosLibrarySummaryCardProps {
  onOpen: () => void
  refreshNonce?: number
}

const CosLibrarySummaryCard: React.FC<CosLibrarySummaryCardProps> = ({ onOpen, refreshNonce = 0 }) => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [cosDisabled, setCosDisabled] = useState(false)
  const [stats, setStats] = useState<{ imageCount: number; totalBytes: number } | null>(null)

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
        <div className="cos-library-summary-card__stats" title="点击进入云图库">
          <span>
            <Typography.Text strong>{stats?.imageCount ?? 0}</Typography.Text>
            <Typography.Text type="secondary"> 张</Typography.Text>
          </span>
          <Typography.Text type="secondary" className="cos-library-summary-card__sep">
            ·
          </Typography.Text>
          <Typography.Text strong>{formatFileSize(stats?.totalBytes ?? 0)}</Typography.Text>
        </div>
      )}
    </GlassCard>
  )
}

export default CosLibrarySummaryCard
