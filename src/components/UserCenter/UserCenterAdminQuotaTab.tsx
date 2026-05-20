import React, { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Progress,
  Select,
  Space,
  Table,
  Typography,
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { SearchOutlined, PlusOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  adminAdjustUserCosQuota,
  adminGetUserCosQuota,
  adminGetUserCosQuotaHistory,
  adminListUsersCosQuota,
  formatAuthApiError,
  formatFileSize,
  type AdminQuotaAdjustment,
  type AdminUserCosQuota,
  type AdminUserCosQuotaListItem,
  type AdminUserCosQuotaListQuery,
} from '../../utils'
import { TbCloud, TbDatabase, TbPhoto } from '../icons'
import { PageSection, StatCard } from '../UnifiedUI'

const { Text } = Typography
const STAT_ICON_SIZE = 18
const GB = 1024 * 1024 * 1024

function bytesFromGb(gb: number | null | undefined): number | undefined {
  if (gb == null || !Number.isFinite(gb)) return undefined
  return Math.round(gb * GB)
}

function usagePercent(item: AdminUserCosQuotaListItem): number | null {
  if (!item.usage || item.quotaBytes <= 0) return null
  return Math.min(100, Math.round((item.usage.totalBytes / item.quotaBytes) * 100))
}

const UserCenterAdminQuotaTab: React.FC = () => {
  const { message } = App.useApp()
  const [listLoading, setListLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [listResult, setListResult] = useState<{
    items: AdminUserCosQuotaListItem[]
    total: number
    page: number
    pageSize: number
    defaultQuotaBytesForNewUsers: number
    cosConfigured: boolean
  } | null>(null)
  const [filters, setFilters] = useState<AdminUserCosQuotaListQuery>({
    page: 1,
    pageSize: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    withUsage: true,
    usageLevel: 'all',
  })
  const [filterForm] = Form.useForm<{
    keyword?: string
    minQuotaGb?: number
    maxQuotaGb?: number
    sortBy: AdminUserCosQuotaListQuery['sortBy']
    sortOrder: AdminUserCosQuotaListQuery['sortOrder']
    withUsage: boolean
    usageLevel: AdminUserCosQuotaListQuery['usageLevel']
  }>()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [quota, setQuota] = useState<AdminUserCosQuota | null>(null)
  const [history, setHistory] = useState<AdminQuotaAdjustment[]>([])
  const [rechargeForm] = Form.useForm<{ addGb: number; remark?: string }>()
  const [setForm] = Form.useForm<{ quotaGb: number; remark?: string }>()

  const loadList = useCallback(
    async (query: AdminUserCosQuotaListQuery) => {
      setListLoading(true)
      try {
        const data = await adminListUsersCosQuota(query)
        setListResult({
          items: data.items,
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          defaultQuotaBytesForNewUsers: data.defaultQuotaBytesForNewUsers,
          cosConfigured: data.cosConfigured,
        })
      } catch (e) {
        message.error(formatAuthApiError(e))
      } finally {
        setListLoading(false)
      }
    },
    [message]
  )

  useEffect(() => {
    void loadList(filters)
  }, [filters, loadList])

  const resetDetailForms = useCallback(
    (quotaBytes: number) => {
      rechargeForm.resetFields()
      setForm.resetFields()
      setForm.setFieldsValue({ quotaGb: quotaBytes / GB })
    },
    [rechargeForm, setForm]
  )

  const loadUserDetail = useCallback(
    async (userId: string) => {
      setSelectedUserId(userId)
      setDetailLoading(true)
      try {
        const data = await adminGetUserCosQuota({ userId })
        setQuota(data)
        try {
          const rows = await adminGetUserCosQuotaHistory(data.userId, 30)
          setHistory(rows)
        } catch (historyErr) {
          setHistory([])
          message.warning(`配额已加载，调整记录加载失败：${formatAuthApiError(historyErr)}`)
        }
        resetDetailForms(data.quotaBytes)
      } catch (e) {
        setQuota(null)
        setHistory([])
        message.error(formatAuthApiError(e))
      } finally {
        setDetailLoading(false)
      }
    },
    [message, resetDetailForms]
  )

  const refreshListAndDetail = useCallback(async () => {
    await loadList(filters)
    if (selectedUserId) {
      await loadUserDetail(selectedUserId)
    }
  }, [filters, loadList, loadUserDetail, selectedUserId])

  const onSearch = (values: {
    keyword?: string
    minQuotaGb?: number
    maxQuotaGb?: number
    sortBy: AdminUserCosQuotaListQuery['sortBy']
    sortOrder: AdminUserCosQuotaListQuery['sortOrder']
    withUsage: boolean
    usageLevel: AdminUserCosQuotaListQuery['usageLevel']
  }) => {
    let withUsage = values.withUsage
    const usageLevel = values.usageLevel ?? 'all'
    if (usageLevel !== 'all' && !withUsage) {
      withUsage = true
      filterForm.setFieldValue('withUsage', true)
      message.info('已自动开启 COS 用量加载，以应用用量筛选')
    }
    setFilters({
      keyword: values.keyword?.trim() || undefined,
      minQuotaGb: values.minQuotaGb,
      maxQuotaGb: values.maxQuotaGb,
      sortBy: values.sortBy ?? 'createdAt',
      sortOrder: values.sortOrder ?? 'desc',
      withUsage,
      usageLevel,
      page: 1,
      pageSize: filters.pageSize ?? 20,
    })
  }

  const onResetFilters = () => {
    filterForm.resetFields()
    filterForm.setFieldsValue({
      sortBy: 'createdAt',
      sortOrder: 'desc',
      withUsage: true,
      usageLevel: 'all',
    })
    setFilters({
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      withUsage: true,
      usageLevel: 'all',
    })
  }

  const refreshHistory = useCallback(async (userId: string) => {
    const rows = await adminGetUserCosQuotaHistory(userId, 30)
    setHistory(rows)
  }, [])

  const onRecharge = async (values: { addGb: number; remark?: string }) => {
    if (!quota) return
    const addQuotaBytes = bytesFromGb(values.addGb)
    if (!addQuotaBytes || addQuotaBytes <= 0) {
      message.warning('充值容量须大于 0')
      return
    }
    setDetailLoading(true)
    try {
      const res = await adminAdjustUserCosQuota({
        userId: quota.userId,
        addQuotaBytes,
        remark: values.remark?.trim() || undefined,
      })
      message.success(
        `已为 ${res.email} 充值 ${formatFileSize(res.deltaBytes)}，当前上限 ${formatFileSize(res.newQuotaBytes)}`
      )
      resetDetailForms(res.newQuotaBytes)
      await refreshListAndDetail()
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setDetailLoading(false)
    }
  }

  const onSetQuota = async (values: { quotaGb: number; remark?: string }) => {
    if (!quota) return
    const quotaBytes = bytesFromGb(values.quotaGb)
    if (!quotaBytes) {
      message.warning('请输入有效配额')
      return
    }
    setDetailLoading(true)
    try {
      const res = await adminAdjustUserCosQuota({
        userId: quota.userId,
        quotaBytes,
        remark: values.remark?.trim() || undefined,
      })
      message.success(`已将 ${res.email} 配额设为 ${formatFileSize(res.newQuotaBytes)}`)
      resetDetailForms(res.newQuotaBytes)
      await refreshListAndDetail()
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setDetailLoading(false)
    }
  }

  const usagePercentDetail =
    quota?.usage && quota.quotaBytes > 0
      ? Math.min(100, Math.round((quota.usage.totalBytes / quota.quotaBytes) * 100))
      : 0

  const listColumns: ColumnsType<AdminUserCosQuotaListItem> = [
    {
      title: '邮箱',
      dataIndex: 'email',
      ellipsis: true,
      render: (email: string, row) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => void loadUserDetail(row.userId)}>
          {email}
        </Button>
      ),
    },
    {
      title: '昵称',
      dataIndex: 'displayName',
      ellipsis: true,
      render: (v: string) => v || '—',
    },
    {
      title: '存储上限',
      dataIndex: 'quotaBytes',
      width: 110,
      render: (v: number) => formatFileSize(v),
    },
    {
      title: '已用',
      key: 'used',
      width: 110,
      render: (_, row) => (row.usage ? formatFileSize(row.usage.totalBytes) : '—'),
    },
    {
      title: '图片',
      key: 'images',
      width: 72,
      render: (_, row) => (row.usage != null ? row.usage.imageCount : '—'),
    },
    {
      title: '使用率',
      key: 'percent',
      width: 140,
      render: (_, row) => {
        const p = usagePercent(row)
        if (p == null) return <Text type="secondary">—</Text>
        return (
          <Progress
            percent={p}
            size="small"
            showInfo
            strokeColor={p >= 90 ? 'var(--app-danger, #ff3b30)' : 'var(--app-primary, #0a84ff)'}
          />
        )
      },
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      width: 168,
      render: (t: number) => new Date(t).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 88,
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => void loadUserDetail(row.userId)}>
          管理
        </Button>
      ),
    },
  ]

  const historyColumns: ColumnsType<AdminQuotaAdjustment> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 168,
      render: (t: number) => new Date(t).toLocaleString('zh-CN'),
    },
    {
      title: '变更',
      key: 'delta',
      render: (_, row) => (
        <Text type={row.deltaBytes >= 0 ? 'success' : 'danger'}>
          {row.deltaBytes > 0 ? '+' : row.deltaBytes < 0 ? '-' : ''}
          {formatFileSize(row.deltaBytes)}
        </Text>
      ),
    },
    {
      title: '调整前',
      dataIndex: 'previousQuotaBytes',
      render: (v: number) => formatFileSize(v),
    },
    {
      title: '调整后',
      dataIndex: 'newQuotaBytes',
      render: (v: number) => formatFileSize(v),
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true, render: (v: string | null) => v || '—' },
  ]

  const onTableChange = (pagination: TablePaginationConfig) => {
    setFilters((prev) => ({
      ...prev,
      page: pagination.current ?? 1,
      pageSize: pagination.pageSize ?? 20,
    }))
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <PageSection
        title="用户云图库配额"
        subtitle="浏览全部用户配额与用量；点击行或「管理」可充值、改上限与查看记录"
      >
        <Form
          form={filterForm}
          layout="inline"
          initialValues={{
            sortBy: 'createdAt',
            sortOrder: 'desc',
            withUsage: true,
            usageLevel: 'all',
          }}
          onFinish={onSearch}
          style={{ marginBottom: 16, rowGap: 8 }}
        >
          <Form.Item name="keyword" label="关键词">
            <Input placeholder="邮箱或昵称" allowClear style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="minQuotaGb" label="配额下限">
            <InputNumber min={0} step={1} placeholder="GB" addonAfter="GB" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="maxQuotaGb" label="配额上限">
            <InputNumber min={0} step={1} placeholder="GB" addonAfter="GB" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="usageLevel" label="用量">
            <Select
              style={{ width: 120 }}
              options={[
                { value: 'all', label: '全部' },
                { value: 'high', label: '紧张 ≥90%' },
                { value: 'over', label: '已满 ≥100%' },
              ]}
            />
          </Form.Item>
          <Form.Item name="sortBy" label="排序">
            <Select
              style={{ width: 120 }}
              options={[
                { value: 'createdAt', label: '注册时间' },
                { value: 'email', label: '邮箱' },
                { value: 'displayName', label: '昵称' },
                { value: 'quotaBytes', label: '存储上限' },
              ]}
            />
          </Form.Item>
          <Form.Item name="sortOrder" label="顺序">
            <Select
              style={{ width: 88 }}
              options={[
                { value: 'desc', label: '降序' },
                { value: 'asc', label: '升序' },
              ]}
            />
          </Form.Item>
          <Form.Item name="withUsage" label="COS 用量">
            <Select
              style={{ width: 100 }}
              options={[
                { value: true, label: '加载' },
                { value: false, label: '跳过' },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={listLoading}>
                查询
              </Button>
              <Button onClick={onResetFilters}>重置</Button>
              <Button icon={<ReloadOutlined />} onClick={() => void loadList(filters)} loading={listLoading}>
                刷新
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {listResult ? (
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            共 {listResult.total} 位用户
            {listResult.cosConfigured ? '' : '（COS 未配置，用量显示为 —）'}
            {listResult.defaultQuotaBytesForNewUsers > 0
              ? ` · 新用户默认配额 ${formatFileSize(listResult.defaultQuotaBytesForNewUsers)}`
              : ''}
          </Text>
        ) : null}

        <Table<AdminUserCosQuotaListItem>
          size="small"
          rowKey="userId"
          loading={listLoading}
          dataSource={listResult?.items ?? []}
          columns={listColumns}
          pagination={{
            current: listResult?.page ?? filters.page ?? 1,
            pageSize: listResult?.pageSize ?? filters.pageSize ?? 20,
            total: listResult?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={onTableChange}
          rowClassName={(row) => (row.userId === selectedUserId ? 'user-center-admin-quota-row--active' : '')}
          onRow={(row) => ({
            onClick: () => void loadUserDetail(row.userId),
            style: { cursor: 'pointer' },
          })}
        />
      </PageSection>

      {quota ? (
        <PageSection title="用户详情与调整" subtitle="选中用户的配额、用量与操作">
          <Space direction="vertical" size="small" style={{ width: '100%', marginBottom: 16 }}>
            <Text>
              <Text strong>{quota.displayName || quota.email}</Text>
              <Text type="secondary"> ({quota.email})</Text>
            </Text>
            <Text type="secondary" copyable>
              用户 ID：{quota.userId}
            </Text>
          </Space>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <StatCard
              title="当前上限"
              value={formatFileSize(quota.quotaBytes)}
              icon={<TbDatabase size={STAT_ICON_SIZE} aria-hidden />}
              accent="#0a84ff"
              subtle
            />
            <StatCard
              title="已用空间"
              value={quota.usage ? formatFileSize(quota.usage.totalBytes) : '—'}
              icon={<TbCloud size={STAT_ICON_SIZE} aria-hidden />}
              accent="#5ac8fa"
              subtle
            />
            <StatCard
              title="图片张数"
              value={quota.usage?.imageCount ?? '—'}
              icon={<TbPhoto size={STAT_ICON_SIZE} aria-hidden />}
              accent="#30b95a"
              subtle
            />
          </div>

          {quota.usage ? (
            <div style={{ marginBottom: 20 }}>
              <Progress
                percent={usagePercentDetail}
                strokeColor={
                  usagePercentDetail >= 90 ? 'var(--app-danger, #ff3b30)' : 'var(--app-primary, #0a84ff)'
                }
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                已用 {formatFileSize(quota.usage.totalBytes)} / {formatFileSize(quota.quotaBytes)}
              </Text>
            </div>
          ) : null}

          <div className="user-center-admin-quota-forms">
            <PageSection title="充值扩容" subtitle="在现有上限基础上增加容量">
              <Form form={rechargeForm} layout="vertical" onFinish={(v) => void onRecharge(v)}>
                <Form.Item
                  name="addGb"
                  label="增加容量 (GB)"
                  rules={[{ required: true, message: '请输入充值 GB 数' }]}
                >
                  <InputNumber min={0.1} step={1} precision={2} style={{ width: '100%' }} addonAfter="GB" />
                </Form.Item>
                <Form.Item name="remark" label="备注（可选）">
                  <Input placeholder="如订单号、充值渠道" maxLength={256} />
                </Form.Item>
                <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={detailLoading}>
                  确认充值
                </Button>
              </Form>
            </PageSection>

            <PageSection title="设为指定上限" subtitle="直接覆盖该用户的配额总量">
              <Form form={setForm} layout="vertical" onFinish={(v) => void onSetQuota(v)}>
                <Form.Item
                  name="quotaGb"
                  label="存储上限 (GB)"
                  rules={[{ required: true, message: '请输入配额' }]}
                >
                  <InputNumber min={0.001} step={1} precision={3} style={{ width: '100%' }} addonAfter="GB" />
                </Form.Item>
                <Form.Item name="remark" label="备注（可选）">
                  <Input placeholder="调整原因" maxLength={256} />
                </Form.Item>
                <Button type="primary" htmlType="submit" icon={<EditOutlined />} loading={detailLoading}>
                  保存配额
                </Button>
              </Form>
            </PageSection>
          </div>

          <PageSection
            title="调整记录"
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => void refreshHistory(quota.userId)}
                disabled={detailLoading}
              >
                刷新
              </Button>
            }
          >
            <Table<AdminQuotaAdjustment>
              size="small"
              rowKey="id"
              loading={detailLoading}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              dataSource={history}
              columns={historyColumns}
            />
          </PageSection>
        </PageSection>
      ) : (
        <Text type="secondary">在上方列表中点击用户，可在此进行充值或调整配额。</Text>
      )}
    </Space>
  )
}

export default UserCenterAdminQuotaTab
