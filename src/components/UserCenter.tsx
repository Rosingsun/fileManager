import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Divider,
  Alert,
  App,
  Tag,
  Table,
  Modal,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  UserOutlined,
  CameraOutlined,
  LoadingOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
  ApiOutlined,
  LogoutOutlined,
  TeamOutlined,
  HistoryOutlined,
  DashboardOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../stores'
import {
  authFetchJson,
  cosDelete,
  formatAuthApiError,
  getAuthApiBaseUrl,
  isAllowedAvatarFile,
  isAuthApiConfigured,
  isCosAvatarRef,
  logSignedInUserAction,
  parseCosAvatarKey,
  uploadAvatarToCos,
  AVATAR_SELECT_MAX_BYTES,
  AuthApiError,
  cosImageStats,
} from '../utils'
import UserAvatar from './UserAvatar'
import OperationLogTab from './OperationLogTab'
import UserCenterOverviewTab from './UserCenter/UserCenterOverviewTab'
import UserCenterUsageStatsTab from './UserCenter/UserCenterUsageStatsTab'
import UserCenterPreferencesTab from './UserCenter/UserCenterPreferencesTab'
import UserCenterSidebar, { type UserCenterSidebarNavEntry } from './UserCenter/UserCenterSidebar'
import {
  desensitizeEmail,
  userCenterCardStyle,
  type UserCenterAppNavigate,
  type UserCenterTabKey,
} from './UserCenter/userCenterShared'

export interface UserCenterProps {
  focusTab?: string | null
  onFocusTabConsumed?: () => void
  onNavigateApp: (target: UserCenterAppNavigate) => void
}

interface MyInviteCodeRow {
  id: string
  code: string | null
  createdAt: number
  expiresAt: number | null
  maxUses: number
  usedCount: number
  revokedAt: number | null
  note: string | null
  remainingSlots: number
  isValid: boolean
}

interface MyInviteRecordRow {
  id: string
  inviteCodeId: string
  inviteeUserId: string
  inviteeEmail: string
  redeemedAt: number
}

interface InviteQuota {
  maxInvitees: number
  redeemedCount: number
  maxGenerationsPerDay: number
  generationsToday: number
}

const UserCenter: React.FC<UserCenterProps> = ({ focusTab, onFocusTabConsumed, onNavigateApp }) => {
  const { message } = App.useApp()
  const baseUrl = getAuthApiBaseUrl()
  const apiDisplayLabel = baseUrl || '—'

  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const logout = useAuthStore((s) => s.logout)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const changePassword = useAuthStore((s) => s.changePassword)

  const [profileForm] = Form.useForm()
  const [pwdForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [about, setAbout] = useState<{ version: string; platform: string } | null>(null)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [healthChecking, setHealthChecking] = useState(false)
  const [inviteCodes, setInviteCodes] = useState<MyInviteCodeRow[]>([])
  const [inviteRecords, setInviteRecords] = useState<MyInviteRecordRow[]>([])
  const [inviteQuota, setInviteQuota] = useState<InviteQuota | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [activeUserTab, setActiveUserTab] = useState<UserCenterTabKey>('overview')
  const [cosConfigured, setCosConfigured] = useState<boolean | null>(null)

  const formatTs = (ms: number) => new Date(ms).toLocaleString()

  const checkCosStatus = useCallback(async () => {
    try {
      await cosImageStats()
      setCosConfigured(true)
    } catch (e) {
      setCosConfigured(e instanceof AuthApiError && e.code === 'COS_NOT_CONFIGURED' ? false : null)
    }
  }, [])

  const loadInviteLists = useCallback(async () => {
    setInviteLoading(true)
    try {
      const [codes, records, quota] = await Promise.all([
        authFetchJson<MyInviteCodeRow[]>('/invites/codes', { method: 'GET' }),
        authFetchJson<MyInviteRecordRow[]>('/invites/records', { method: 'GET' }),
        authFetchJson<InviteQuota>('/invites/quota', { method: 'GET' }),
      ])
      setInviteCodes(codes)
      setInviteRecords(records)
      setInviteQuota(quota)
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setInviteLoading(false)
    }
  }, [message])

  const userCenterNavItems: UserCenterSidebarNavEntry[] = [
    { key: 'overview', label: '概览', group: 'workspace', icon: <DashboardOutlined /> },
    { key: 'stats', label: '使用统计', group: 'workspace', icon: <BarChartOutlined /> },
    { key: 'preferences', label: '偏好与数据', group: 'workspace', icon: <SettingOutlined /> },
    { key: 'profile', label: '个人信息', group: 'account', icon: <UserOutlined /> },
    { key: 'security', label: '账号安全', group: 'account', icon: <SafetyOutlined /> },
    { key: 'invites', label: '我的邀请', group: 'account', icon: <TeamOutlined /> },
    { key: 'oplog', label: '操作日志', group: 'system', icon: <HistoryOutlined /> },
    { key: 'about', label: '关于与服务', group: 'system', icon: <InfoCircleOutlined /> },
  ]

  const onUserTabChange = useCallback(
    (key: UserCenterTabKey) => {
      setActiveUserTab(key)
      if (key === 'invites') void loadInviteLists()
      if (key === 'about') void checkCosStatus()
    },
    [loadInviteLists, checkCosStatus]
  )

  useEffect(() => {
    if (!focusTab) return
    if (userCenterNavItems.some((item) => item.key === focusTab)) {
      onUserTabChange(focusTab as UserCenterTabKey)
      onFocusTabConsumed?.()
    }
  }, [focusTab, onFocusTabConsumed, onUserTabChange, userCenterNavItems])

  const onCreateInvite = async () => {
    setInviteLoading(true)
    try {
      const data = await authFetchJson<{
        code: string
        id: string
        createdAt: number
        expiresAt: number
        maxUses?: number
      }>('/invites', { method: 'POST', body: JSON.stringify({}) })
      Modal.success({
        title: '邀请码已生成',
        width: 480,
        content: (
          <div>
            <Typography.Paragraph>请复制并分享给受邀者；您也可在下方「我发出的邀请码」列表中再次复制。有效期至：</Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {formatTs(data.expiresAt)}
            </Typography.Paragraph>
            <Typography.Paragraph copyable strong style={{ fontSize: 18 }}>
              {data.code}
            </Typography.Paragraph>
          </div>
        ),
      })
      await loadInviteLists()
      logSignedInUserAction('invite_code_created', '生成新邀请码')
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setInviteLoading(false)
    }
  }

  useEffect(() => {
    if (user && accessToken) {
      profileForm.setFieldsValue({
        displayName: user.displayName,
      })
    }
  }, [user, accessToken, profileForm])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.getAppVersion || !api.getPlatform) return
    void Promise.all([api.getAppVersion(), api.getPlatform()]).then(([version, platform]) => {
      setAbout({ version, platform })
    })
  }, [])

  const cardStyle = userCenterCardStyle

  const checkServiceHealth = async () => {
    if (!isAuthApiConfigured()) return
    setHealthChecking(true)
    try {
      const res = await fetch(`${baseUrl}/health`)
      const raw = (await res.json()) as { ok?: boolean; data?: { status?: string } }
      setHealthOk(raw.ok === true && raw.data?.status === 'ok')
    } catch {
      setHealthOk(false)
    } finally {
      setHealthChecking(false)
    }
  }

  const onPickAvatarFile = async (file: File) => {
    if (!isAllowedAvatarFile(file)) {
      message.warning('请选择 JPG、PNG、WebP 或 GIF 图片')
      return
    }
    if (file.size > AVATAR_SELECT_MAX_BYTES) {
      message.warning('图片不能超过 10MB')
      return
    }
    setAvatarUploading(true)
    const prevKey = user?.avatarUrl && isCosAvatarRef(user.avatarUrl) ? parseCosAvatarKey(user.avatarUrl) : null
    try {
      const cosRef = await uploadAvatarToCos(file)
      await updateProfile({ avatarUrl: cosRef })
      if (prevKey) {
        try {
          await cosDelete({ key: prevKey })
        } catch {
          /* 旧头像清理失败不影响主流程 */
        }
      }
      message.success('头像已更新')
      logSignedInUserAction('profile_updated', '上传头像')
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const onAvatarInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void onPickAvatarFile(file)
  }

  const onSaveProfile = async () => {
    const v = await profileForm.validateFields()
    setLoading(true)
    try {
      await updateProfile({
        displayName: v.displayName,
      })
      message.success('已保存')
      logSignedInUserAction('profile_updated', '更新个人资料')
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setLoading(false)
    }
  }

  const onChangePassword = async () => {
    const v = await pwdForm.validateFields()
    setLoading(true)
    try {
      await changePassword(v.currentPassword, v.newPassword)
      pwdForm.resetFields()
      message.success('密码已更新，请使用新密码重新登录')
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setLoading(false)
    }
  }

  const onLogout = async () => {
    setLoading(true)
    try {
      await logout()
      pwdForm.resetFields()
      message.success('已退出')
    } finally {
      setLoading(false)
    }
  }

  const apiWarning =
    !isAuthApiConfigured() ? (
      <Alert
        type="warning"
        showIcon
        closable
        style={{ marginBottom: 16 }}
        message="未检测到认证服务地址"
        description={
          <>
            当前为生产或未注入环境变量：请在根目录 <Typography.Text code>.env.production</Typography.Text> / 构建流水线中设置{' '}
            <Typography.Text code>VITE_AUTH_API_BASE_URL</Typography.Text>（与后端一致、无尾部斜杠）。开发环境通常使用仓库内{' '}
            <Typography.Text code>.env.development</Typography.Text>，默认 <Typography.Text code>http://localhost:3847</Typography.Text>。
          </>
        }
      />
    ) : null

  if (!user || !accessToken) return null

  const panelProps = {
    userId: user.id,
    onNavigateApp,
    onSwitchUserTab: (key: string) => onUserTabChange(key as UserCenterTabKey),
  }

  return (
      <div className="app-tab-panel user-center-root">
        {apiWarning}
        <div className="user-center-shell">
          <UserCenterSidebar
            items={userCenterNavItems}
            activeKey={activeUserTab}
            onChange={onUserTabChange}
            profile={
              <button
                type="button"
                className="user-center-sidebar-profile"
                onClick={() => onUserTabChange('profile')}
              >
                <UserAvatar size={40} avatarUrl={user.avatarUrl} />
                <span className="user-center-sidebar-profile__text">
                  <span className="user-center-sidebar-profile__name">{user.displayName}</span>
                  <span className="user-center-sidebar-profile__email">{desensitizeEmail(user.email)}</span>
                </span>
              </button>
            }
          />
          <main className="user-center-main">
            {activeUserTab === 'overview' && <UserCenterOverviewTab {...panelProps} />}
            {activeUserTab === 'stats' && <UserCenterUsageStatsTab userId={user.id} />}
            {activeUserTab === 'preferences' && <UserCenterPreferencesTab onNavigateApp={onNavigateApp} />}
            {activeUserTab === 'profile' && (
              <Card title="资料与展示" style={cardStyle} className="user-center-panel-card">
                <Space align="start" size="large" wrap className="user-center-profile-header user-center-profile-header--panel">
                        <button
                          type="button"
                          className="user-center-avatar-upload"
                          disabled={avatarUploading}
                          aria-label="上传头像"
                          onClick={() => avatarInputRef.current?.click()}
                        >
                          <UserAvatar size={72} avatarUrl={user.avatarUrl} />
                          <span className="user-center-avatar-upload-mask">
                            {avatarUploading ? <LoadingOutlined spin /> : <CameraOutlined />}
                          </span>
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="user-center-avatar-input"
                            onChange={onAvatarInputChange}
                          />
                        </button>
                        <div>
                          <Typography.Title level={5} style={{ marginTop: 0 }}>
                            {user.displayName}
                          </Typography.Title>
                          <Typography.Text type="secondary">{desensitizeEmail(user.email)}</Typography.Text>
                          {user.createdAt != null ? (
                            <div style={{ marginTop: 6 }}>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                注册于 {formatTs(user.createdAt)}
                              </Typography.Text>
                            </div>
                          ) : null}
                          {user.invitedByUserId ? (
                            <div style={{ marginTop: 8 }}>
                              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                                由邀请注册（邀请人用户 ID：{user.invitedByUserId}）
                              </Typography.Text>
                            </div>
                          ) : null}
                        </div>
                      </Space>
                      <Divider />
                      <Form form={profileForm} layout="vertical" onFinish={() => void onSaveProfile()}>
                        <Form.Item name="displayName" label="昵称" rules={[{ max: 64, message: '最长 64 字符' }]}>
                          <Input placeholder="显示名称" />
                        </Form.Item>
                        <Form.Item style={{ marginBottom: 0 }}>
                          <div className="user-center-actions-row">
                            <Button type="primary" htmlType="submit" size="large" loading={loading}>
                              保存资料
                            </Button>
                            <Button onClick={() => void fetchProfile()} loading={loading}>
                              从服务器刷新
                            </Button>
                            <Button danger icon={<LogoutOutlined />} onClick={() => void onLogout()} loading={loading}>
                              退出登录
                            </Button>
                          </div>
                        </Form.Item>
                      </Form>
              </Card>
            )}
            {activeUserTab === 'security' && (
              <Card
                      title="修改登录密码"
                      style={cardStyle}
                      extra={<Tag color="blue">修改后所有设备需重新登录</Tag>}
                    >
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="修改成功后将清除本地会话，请使用新密码重新登录。"
                      />
                      <Form form={pwdForm} layout="vertical" onFinish={() => void onChangePassword()}>
                        <Form.Item
                          name="currentPassword"
                          label="当前密码"
                          rules={[{ required: true, message: '请输入当前密码' }]}
                        >
                          <Input.Password autoComplete="current-password" />
                        </Form.Item>
                        <Form.Item
                          name="newPassword"
                          label="新密码"
                          rules={[
                            { required: true, message: '请输入新密码' },
                            { min: 8, message: '至少 8 位' },
                          ]}
                        >
                          <Input.Password autoComplete="new-password" />
                        </Form.Item>
                        <Form.Item
                          name="confirmPassword"
                          label="确认新密码"
                          dependencies={['newPassword']}
                          rules={[
                            { required: true, message: '请再次输入新密码' },
                            ({ getFieldValue }) => ({
                              validator(_, value) {
                                if (!value || getFieldValue('newPassword') === value) {
                                  return Promise.resolve()
                                }
                                return Promise.reject(new Error('两次输入的密码不一致'))
                              },
                            }),
                          ]}
                        >
                          <Input.Password autoComplete="new-password" />
                        </Form.Item>
                        <Form.Item>
                          <div className="user-center-actions-row">
                            <Button type="primary" htmlType="submit" size="large" loading={loading} style={{ minWidth: 140 }}>
                              更新密码
                            </Button>
                          </div>
                        </Form.Item>
                      </Form>
              </Card>
            )}
            {activeUserTab === 'oplog' && (
              <OperationLogTab userId={user.id} onOpenUsageStats={() => onUserTabChange('stats')} />
            )}
            {activeUserTab === 'invites' && (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <Card title="生成邀请码" style={cardStyle}>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                          同一时间仅保留一条可用邀请码；再次生成会使上一条立即失效。邀请码自创建起 3 天内有效。
                        </Typography.Paragraph>
                        {inviteQuota && inviteQuota.generationsToday >= inviteQuota.maxGenerationsPerDay ? (
                          <Alert
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="今日生成次数已达上限"
                            description={`今日已生成 ${inviteQuota.generationsToday} / ${inviteQuota.maxGenerationsPerDay} 次（按 UTC 日切分），请明日再试或联系运维调整参数表。`}
                          />
                        ) : null}
                        {inviteQuota && inviteQuota.redeemedCount >= inviteQuota.maxInvitees ? (
                          <Alert
                            type="warning"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="已达邀请人数上限"
                            description={`已成功邀请 ${inviteQuota.redeemedCount} / ${inviteQuota.maxInvitees} 人，无法生成新邀请码。若需提高上限，请由运维调整参数表。`}
                          />
                        ) : inviteQuota ? (
                          <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message={`还可邀请 ${Math.max(0, inviteQuota.maxInvitees - inviteQuota.redeemedCount)} 人（已成功 ${inviteQuota.redeemedCount} / ${inviteQuota.maxInvitees}）；今日还可生成 ${Math.max(0, inviteQuota.maxGenerationsPerDay - inviteQuota.generationsToday)} 次邀请码（已生成 ${inviteQuota.generationsToday} / ${inviteQuota.maxGenerationsPerDay}）`}
                          />
                        ) : null}
                        <div className="user-center-actions-row">
                          <Button
                            type="primary"
                            size="large"
                            loading={inviteLoading}
                            disabled={
                              !!inviteQuota &&
                              (inviteQuota.redeemedCount >= inviteQuota.maxInvitees ||
                                inviteQuota.generationsToday >= inviteQuota.maxGenerationsPerDay)
                            }
                            onClick={() => void onCreateInvite()}
                          >
                            生成新邀请码
                          </Button>
                        </div>
                      </Card>
                      <Card title="我发出的邀请码" style={cardStyle}>
                        <Table<MyInviteCodeRow>
                          size="small"
                          rowKey="id"
                          loading={inviteLoading}
                          pagination={false}
                          dataSource={inviteCodes}
                          columns={
                            [
                              {
                                title: '创建时间',
                                dataIndex: 'createdAt',
                                render: (t: number) => formatTs(t),
                              },
                              {
                                title: '邀请码',
                                key: 'code',
                                width: 220,
                                render: (_, row) =>
                                  row.code ? (
                                    <Typography.Text copyable strong>
                                      {row.code}
                                    </Typography.Text>
                                  ) : (
                                    <Typography.Text type="secondary">—</Typography.Text>
                                  ),
                              },
                              {
                                title: '过期时间',
                                dataIndex: 'expiresAt',
                                render: (t: number | null) => (t ? formatTs(t) : '—'),
                              },
                              {
                                title: '剩余次数',
                                key: 'rem',
                                render: (_, row) => `${row.remainingSlots} / ${row.maxUses}`,
                              },
                              {
                                title: '状态',
                                key: 'st',
                                render: (_, row) =>
                                  row.revokedAt != null ? (
                                    <Tag>已撤销</Tag>
                                  ) : row.isValid ? (
                                    <Tag color="success">可用</Tag>
                                  ) : (
                                    <Tag color="default">不可用</Tag>
                                  ),
                              },
                            ] as ColumnsType<MyInviteCodeRow>
                          }
                        />
                      </Card>
                      <Card title="邀请成功记录" style={cardStyle}>
                        <Table<MyInviteRecordRow>
                          size="small"
                          rowKey="id"
                          loading={inviteLoading}
                          pagination={false}
                          dataSource={inviteRecords}
                          columns={
                            [
                              {
                                title: '受邀邮箱',
                                dataIndex: 'inviteeEmail',
                              },
                              {
                                title: '注册成功时间',
                                dataIndex: 'redeemedAt',
                                render: (t: number) => formatTs(t),
                              },
                              {
                                title: '受邀用户 ID',
                                dataIndex: 'inviteeUserId',
                                ellipsis: true,
                              },
                            ] as ColumnsType<MyInviteRecordRow>
                          }
                        />
                      </Card>
              </Space>
            )}
            {activeUserTab === 'about' && (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <Card title="认证服务" style={cardStyle} extra={<ApiOutlined />}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Typography.Text type="secondary">API 地址</Typography.Text>
                          <Typography.Paragraph code copyable style={{ marginBottom: 8 }}>
                            {apiDisplayLabel}
                          </Typography.Paragraph>
                          <Space wrap>
                            <Button onClick={() => void checkServiceHealth()} loading={healthChecking}>
                              检测连接
                            </Button>
                            {healthOk === true && <Tag color="success">认证 API 可达</Tag>}
                            {healthOk === false && <Tag color="error">认证 API 不可达</Tag>}
                            {healthOk === null && <Tag>认证 API 未检测</Tag>}
                            {cosConfigured === true && <Tag color="success">COS 已配置</Tag>}
                            {cosConfigured === false && <Tag color="default">COS 未配置</Tag>}
                            {cosConfigured === null && activeUserTab === 'about' ? (
                              <Tag>COS 未检测</Tag>
                            ) : null}
                          </Space>
                        </Space>
                      </Card>
                      <Card title="关于本应用" style={cardStyle} loading={!about}>
                        {about && (
                          <Typography.Paragraph style={{ marginBottom: 0 }}>
                            版本：{about.version}
                            <br />
                            平台：{about.platform}
                          </Typography.Paragraph>
                        )}
                      </Card>
              </Space>
            )}
          </main>
        </div>
      </div>
    )
}

export default UserCenter
