import React, { useCallback, useEffect, useState } from 'react'
import { App, Card, Col, Empty, Progress, Row, Segmented, Space, Spin, Statistic, Typography } from 'antd'
import {
  aggregateOperationLogs,
  formatAuthApiError,
  listOperationLogs,
  type OperationLogStatsRange,
  type OperationLogStatsSummary,
} from '../../utils'
import { userCenterCardStyle, type UserCenterPanelProps } from './userCenterShared'

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
      <Card style={userCenterCardStyle}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Segmented
            options={RANGE_OPTIONS}
            value={range}
            onChange={(v) => setRange(v as OperationLogStatsRange)}
          />
          <Text type="secondary">基于本机操作日志统计</Text>
        </Space>
      </Card>

      {loading ? (
        <Card style={userCenterCardStyle}>
          <Spin />
        </Card>
      ) : !summary || summary.total === 0 ? (
        <Card style={userCenterCardStyle}>
          <Empty description="暂无操作记录。去「文件整理」选择目录开始使用吧。" />
        </Card>
      ) : (
        <>
          <Card title="操作总览" style={userCenterCardStyle}>
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={8}>
                <Statistic title="记录条数" value={summary.total} />
              </Col>
              {summary.byCategory.slice(0, 5).map((c) => (
                <Col xs={12} sm={8} key={c.category}>
                  <Statistic title={c.label} value={c.count} />
                </Col>
              ))}
            </Row>
          </Card>

          <Card title="分类占比" style={userCenterCardStyle}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {summary.byCategory.map((c) => (
                <div key={c.category}>
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
          </Card>

          <Card title="各能力最近使用" style={userCenterCardStyle}>
            {summary.lastByCategory.length === 0 ? (
              <Text type="secondary">暂无</Text>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {summary.lastByCategory.map((item) => (
                  <div key={item.category} className="user-center-last-action-row">
                    <Text strong>{item.label}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(item.ts).toLocaleString()} · {item.actionLabel}
                      {item.summary ? ` · ${item.summary}` : ''}
                    </Text>
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </>
      )}
    </Space>
  )
}

export default UserCenterUsageStatsTab
