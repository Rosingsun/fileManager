import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Table, Button, Space, Typography, App, Input, Select, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ClearOutlined, ReloadOutlined, BarChartOutlined } from '@ant-design/icons'
import {
  aggregateOperationLogs,
  clearOperationLogs,
  formatAuthApiError,
  listOperationLogs,
  operationLogActionLabel,
  operationLogCategoryOfAction,
  OPERATION_LOG_CATEGORY_LABELS,
  type OperationLogEntry,
  type OperationLogCategory,
} from '../utils'

const cardStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.72)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  borderRadius: 12,
}

const CATEGORY_FILTER_OPTIONS: { label: string; value: OperationLogCategory | 'all' }[] = [
  { label: '全部分类', value: 'all' },
  ...(Object.entries(OPERATION_LOG_CATEGORY_LABELS) as [OperationLogCategory, string][]).map(([value, label]) => ({
    label,
    value,
  })),
]

export interface OperationLogTabProps {
  userId: string
  onOpenUsageStats?: () => void
}

const OperationLogTab: React.FC<OperationLogTabProps> = ({ userId, onOpenUsageStats }) => {
  const { message, modal } = App.useApp()
  const [rows, setRows] = useState<OperationLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<OperationLogCategory | 'all'>('all')
  const [keyword, setKeyword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listOperationLogs(userId, 200)
      setRows(data)
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setLoading(false)
    }
  }, [message, userId])

  useEffect(() => {
    void load()
  }, [load])

  const statsSummary = useMemo(() => aggregateOperationLogs(rows, '30d'), [rows])

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((row) => {
      if (categoryFilter !== 'all' && operationLogCategoryOfAction(row.action) !== categoryFilter) {
        return false
      }
      if (!kw) return true
      const hay = `${operationLogActionLabel(row.action)} ${row.summary ?? ''} ${row.detail ?? ''}`.toLowerCase()
      return hay.includes(kw)
    })
  }, [rows, categoryFilter, keyword])

  const onClear = () => {
    modal.confirm({
      title: '清空操作日志？',
      content: '将删除本机为该账号保存的全部操作记录，且不可恢复。',
      okText: '清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await clearOperationLogs(userId)
          message.success('已清空')
          await load()
        } catch (e) {
          message.error(formatAuthApiError(e))
        }
      },
    })
  }

  const columns: ColumnsType<OperationLogEntry> = [
    {
      title: '时间',
      dataIndex: 'ts',
      width: 200,
      render: (ts: number) => new Date(ts).toLocaleString(),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 160,
      render: (a: string) => operationLogActionLabel(a),
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      ellipsis: true,
    },
    {
      title: '详情',
      dataIndex: 'detail',
      width: 220,
      ellipsis: true,
      render: (d: string | undefined) => d ?? '—',
    },
  ]

  return (
    <Card
      title="本机操作日志"
      style={cardStyle}
      extra={
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          仅保存在本设备，用于回顾登录与主要操作
        </Typography.Text>
      }
    >
      {statsSummary.total > 0 ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`近 30 天共 ${statsSummary.total} 条操作记录`}
          description={
            <Space wrap>
              {statsSummary.byCategory.slice(0, 4).map((c) => (
                <span key={c.category}>
                  {c.label} {c.count}
                </span>
              ))}
              {onOpenUsageStats ? (
                <Button type="link" size="small" icon={<BarChartOutlined />} onClick={onOpenUsageStats}>
                  查看使用统计
                </Button>
              ) : null}
            </Space>
          }
        />
      ) : null}
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          style={{ width: 160 }}
          value={categoryFilter}
          options={CATEGORY_FILTER_OPTIONS}
          onChange={setCategoryFilter}
        />
        <Input.Search
          allowClear
          placeholder="搜索摘要或详情"
          style={{ width: 220 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={setKeyword}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
          刷新
        </Button>
        <Button danger icon={<ClearOutlined />} onClick={onClear} disabled={rows.length === 0}>
          清空日志
        </Button>
      </Space>
      <Table<OperationLogEntry>
        size="small"
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        dataSource={filteredRows}
        columns={columns}
      />
    </Card>
  )
}

export default OperationLogTab
