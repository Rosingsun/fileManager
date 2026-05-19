import React, { useCallback, useState } from 'react'
import { App, Button, Form, Input, InputNumber, Progress, Space, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons'
import {
  adminAdjustUserCosQuota,
  adminGetUserCosQuota,
  adminGetUserCosQuotaHistory,
  formatAuthApiError,
  formatFileSize,
  type AdminQuotaAdjustment,
  type AdminUserCosQuota,
} from '../../utils'
import { PageSection, StatCard } from '../UnifiedUI'

const { Text } = Typography
const GB = 1024 * 1024 * 1024

function bytesFromGb(gb: number | null | undefined): number | undefined {
  if (gb == null || !Number.isFinite(gb)) return undefined
  return Math.round(gb * GB)
}

const UserCenterAdminQuotaTab: React.FC = () => {
  const { message } = App.useApp()
  const [lookupEmail, setLookupEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState<AdminUserCosQuota | null>(null)
  const [history, setHistory] = useState<AdminQuotaAdjustment[]>([])
  const [rechargeForm] = Form.useForm<{ addGb: number; remark?: string }>()
  const [setForm] = Form.useForm<{ quotaGb: number; remark?: string }>()

  const loadUser = useCallback(
    async (email: string) => {
      const trimmed = email.trim().toLowerCase()
      if (!trimmed) {
        message.warning('请输入用户邮箱')
        return
      }
      setLoading(true)
      try {
        const data = await adminGetUserCosQuota({ email: trimmed })
        setQuota(data)
        const rows = await adminGetUserCosQuotaHistory(data.userId, 30)
        setHistory(rows)
        setForm.setFieldsValue({ quotaGb: data.quotaBytes / GB })
        rechargeForm.resetFields()
      } catch (e) {
        setQuota(null)
        setHistory([])
        message.error(formatAuthApiError(e))
      } finally {
        setLoading(false)
      }
    },
    [message, rechargeForm, setForm]
  )

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
    setLoading(true)
    try {
      const res = await adminAdjustUserCosQuota({
        userId: quota.userId,
        addQuotaBytes,
        remark: values.remark?.trim() || undefined,
      })
      message.success(
        `已为 ${res.email} 充值 ${formatFileSize(res.deltaBytes)}，当前上限 ${formatFileSize(res.newQuotaBytes)}`
      )
      await loadUser(quota.email)
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setLoading(false)
    }
  }

  const onSetQuota = async (values: { quotaGb: number; remark?: string }) => {
    if (!quota) return
    const quotaBytes = bytesFromGb(values.quotaGb)
    if (!quotaBytes) {
      message.warning('请输入有效配额')
      return
    }
    setLoading(true)
    try {
      const res = await adminAdjustUserCosQuota({
        userId: quota.userId,
        quotaBytes,
        remark: values.remark?.trim() || undefined,
      })
      message.success(`已将 ${res.email} 配额设为 ${formatFileSize(res.newQuotaBytes)}`)
      await loadUser(quota.email)
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setLoading(false)
    }
  }

  const usagePercent =
    quota?.usage && quota.quotaBytes > 0
      ? Math.min(100, Math.round((quota.usage.totalBytes / quota.quotaBytes) * 100))
      : 0

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
          {row.deltaBytes >= 0 ? '+' : ''}
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

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <PageSection
        title="用户云图库配额"
        subtitle="按用户单独设置存储上限；新用户默认配额见 app_parameters.cos_user_storage_quota_bytes"
      >
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="用户注册邮箱"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            onPressEnter={() => void loadUser(lookupEmail)}
            style={{ width: 280 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={loading}
            onClick={() => void loadUser(lookupEmail)}
          >
            查询
          </Button>
        </Space>

        {quota ? (
          <>
            <Space direction="vertical" size="small" style={{ width: '100%', marginBottom: 16 }}>
              <Text>
                <Text strong>{quota.displayName || quota.email}</Text>
                <Text type="secondary"> ({quota.email})</Text>
              </Text>
              <Text type="secondary" copyable>
                用户 ID：{quota.userId}
              </Text>
              <Text type="secondary">
                新用户默认配额：{formatFileSize(quota.defaultQuotaBytesForNewUsers)}
              </Text>
            </Space>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <StatCard
                title="当前上限"
                value={formatFileSize(quota.quotaBytes)}
                accent="#0a84ff"
                subtle
              />
              <StatCard
                title="已用空间"
                value={quota.usage ? formatFileSize(quota.usage.totalBytes) : '—'}
                accent="#5ac8fa"
                subtle
              />
              <StatCard
                title="图片张数"
                value={quota.usage?.imageCount ?? '—'}
                accent="#30b95a"
                subtle
              />
            </div>

            {quota.usage ? (
              <div style={{ marginBottom: 20 }}>
                <Progress
                  percent={usagePercent}
                  strokeColor={usagePercent >= 90 ? 'var(--app-danger, #ff3b30)' : 'var(--app-primary, #0a84ff)'}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  已用 {formatFileSize(quota.usage.totalBytes)} / {formatFileSize(quota.quotaBytes)}
                </Text>
              </div>
            ) : null}

            <div className="user-center-admin-quota-forms">
              <PageSection title="充值扩容" subtitle="在现有上限基础上增加容量（addQuotaBytes）">
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
                  <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={loading}>
                    确认充值
                  </Button>
                </Form>
              </PageSection>

              <PageSection title="设为指定上限" subtitle="直接覆盖该用户的配额总量（quotaBytes）">
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
                  <Button htmlType="submit" icon={<EditOutlined />} loading={loading}>
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
                  disabled={loading}
                >
                  刷新
                </Button>
              }
            >
              <Table<AdminQuotaAdjustment>
                size="small"
                rowKey="id"
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                dataSource={history}
                columns={historyColumns}
              />
            </PageSection>
          </>
        ) : (
          <Text type="secondary">输入邮箱查询用户后，可为其充值或调整云图库存储上限。</Text>
        )}
      </PageSection>
    </Space>
  )
}

export default UserCenterAdminQuotaTab
