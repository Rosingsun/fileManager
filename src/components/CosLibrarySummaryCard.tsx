import React, { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Spin, Typography } from 'antd'
import { CloudOutlined, ReloadOutlined } from '@ant-design/icons'
import { AuthApiError, cosImageStats, formatAuthApiError, formatFileSize } from '../utils'

export interface CosLibrarySummaryCardProps {
  onOpen: () => void
  refreshNonce?: number
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.72)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  borderRadius: 12,
  flexShrink: 0,
  marginBottom: 12,
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
      <Card size="small" style={cardStyle} title="云图库">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          未配置对象存储，统计不可用
        </Typography.Text>
      </Card>
    )
  }

  return (
    <Card
      size="small"
      style={{ ...cardStyle, cursor: loading ? 'default' : 'pointer' }}
      title={
        <span>
          <CloudOutlined style={{ marginRight: 6 }} />
          云图库
        </span>
      }
      extra={
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
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
        <Spin size="small" />
      ) : (
        <>
          <Typography.Text strong>{stats?.imageCount ?? 0}</Typography.Text>
          <Typography.Text type="secondary"> 张图片 · </Typography.Text>
          <Typography.Text strong>{formatFileSize(stats?.totalBytes ?? 0)}</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8, fontSize: 12 }}>
            点击进入云图库
          </Typography.Paragraph>
        </>
      )}
    </Card>
  )
}

export default CosLibrarySummaryCard
