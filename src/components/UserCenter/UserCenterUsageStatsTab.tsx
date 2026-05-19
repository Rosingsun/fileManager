import React, { useCallback, useEffect, useState } from 'react'
import { App, Col, Empty, Progress, Row, Segmented, Space, Spin, Typography } from 'antd'
import { BarChartOutlined, ThunderboltOutlined } from '@ant-design/icons'
import {
  aggregateOperationLogs,
  formatAuthApiError,
  listOperationLogs,
  type OperationLogStatsRange,
  type OperationLogStatsSummary,
} from '../../utils'
import { PageSection, StatCard } from '../UnifiedUI'
import { type UserCenterPanelProps } from './userCenterShared'

const { Text } = Typography

const RANGE_OPTIONS: { label: string; value: OperationLogStatsRange }[] = [
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '全部', value: 'all' },
]

const UserCenterUsageStatsTab: React.FC<Pick<UserCenterPanelProps, 'userId'>> = ({ userId }) => {
  const { message } = App.useApp()
  const [range, setRange] = useState<OperationLogStatsRange>('30d')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<OperationLogStatsSummary | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const entries = await listOperationLogs(userId, 500)
      setSummary(aggregateOperationLogs(entries, range))
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setLoading(false)
    }
  }, [message, userId, range])

  useEffect(() => {
    void load()
  }, [load])

  const maxCategoryCount = Math.max(1, ...(summary?.byCategory.map((c) => c.count) ?? [1]))

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <PageSection
        title="使用统计"
        subtitle="基于本机操作日志汇总，不会上传至服务器"
        extra={
          <Segmented
            options={RANGE_OPTIONS}
            value={range}
            onChange={(v) => setRange(v as OperationLogStatsRange)}
          />
        }
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          切换时间范围后自动重新统计
        </Text>
      </PageSection>

      {loading ? (
        <PageSection title="加载中">
          <Spin />
        </PageSection>
      ) : !summary || summary.total === 0 ? (
        <PageSection title="暂无数据">
          <Empty description="暂无操作记录。去「文件整理」选择目录开始使用吧。" />
        </PageSection>
      ) : (
        <>
          <PageSection title="操作总览" subtitle={`共 ${summary.total} 条记录`}>
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={8}>
                <StatCard
                  title="记录条数"
                  value={summary.total}
                  icon={<BarChartOutlined />}
                  accent="var(--app-primary)"
                  subtle
                />
              </Col>
              {summary.byCategory.slice(0, 5).map((c) => (
                <Col xs={12} sm={8} key={c.category}>
                  <StatCard title={c.label} value={c.count} icon={<ThunderboltOutlined />} accent="#7c5cff" subtle />
                </Col>
              ))}
            </Row>
          </PageSection>

          <PageSection title="分类占比" subtitle="相对最高频类别的比例">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {summary.byCategory.map((c) => (
                <div key={c.category} className="user-center-stat-bar">
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text>{c.label}</Text>
                    <Text type="secondary">{c.count}</Text>
                  </Space>
                  <Progress
                    percent={Math.round((c.count / maxCategoryCount) * 100)}
                    showInfo={false}
                    strokeColor="var(--app-primary)"
                    size="small"
                  />
                </div>
              ))}
            </Space>
          </PageSection>

          <PageSection title="各能力最近使用">
            {summary.lastByCategory.length === 0 ? (
              <Text type="secondary">暂无</Text>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {summary.lastByCategory.map((item) => (
                  <div key={item.category} className="user-center-last-action-row">
                    <Text strong>{item.label}</Text>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                      {new Date(item.ts).toLocaleString()} · {item.actionLabel}
                      {item.summary ? ` · ${item.summary}` : ''}
                    </Text>
                  </div>
                ))}
              </Space>
            )}
          </PageSection>
        </>
      )}
    </Space>
  )
}

export default UserCenterUsageStatsTab
