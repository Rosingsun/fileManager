import React, { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Avatar,
  Spin,
  Divider,
  Alert,
  App,
  Tag,
  Row,
  Col,
  Table,
  Modal,
  Collapse,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  UserOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
  CloudOutlined,
  LogoutOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../stores'
import { authFetchJson, formatAuthApiError, getAuthApiBaseUrl, getPasswordResetUrl } from '../utils'
import EmailAutoComplete from './EmailAutoComplete'

interface MyInviteCodeRow {
  id: string
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

function desensitizeEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  if (local.length === 0) return `*@${domain}`
  const head = local.length <= 2 ? `${local[0]}***` : `${local.slice(0, 2)}***`
  return `${head}@${domain}`
}

const UserCenter: React.FC = () => {
  const { message } = App.useApp()
  const baseUrl = getAuthApiBaseUrl()
  const resetUrl = getPasswordResetUrl()

  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const isHydrating = useAuthStore((s) => s.isHydrating)
  const hydrateFromRefresh = useAuthStore((s) => s.hydrateFromRefresh)
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const logout = useAuthStore((s) => s.logout)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const changePassword = useAuthStore((s) => s.changePassword)
  const bootstrapFirstUser = useAuthStore((s) => s.bootstrapFirstUser)

  const [loginForm] = Form.useForm()
  const [regForm] = Form.useForm()
  const [bootForm] = Form.useForm()
  const [profileForm] = Form.useForm()
  const [pwdForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [about, setAbout] = useState<{ version: string; platform: string } | null>(null)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [healthChecking, setHealthChecking] = useState(false)
  const [inviteCodes, setInviteCodes] = useState<MyInviteCodeRow[]>([])
  const [inviteRecords, setInviteRecords] = useState<MyInviteRecordRow[]>([])
  const [inviteLoading, setInviteLoading] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  const formatTs = (ms: number) => new Date(ms).toLocaleString()

  const loadInviteLists = useCallback(async () => {
    setInviteLoading(true)
    try {
      const [codes, records] = await Promise.all([
        authFetchJson<MyInviteCodeRow[]>('/invites/codes', { method: 'GET' }),
        authFetchJson<MyInviteRecordRow[]>('/invites/records', { method: 'GET' }),
      ])
      setInviteCodes(codes)
      setInviteRecords(records)
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setInviteLoading(false)
    }
  }, [message])

  const onCreateInvite = async () => {
    setInviteLoading(true)
    try {
      const data = await authFetchJson<{ code: string; id: string; createdAt: number }>(
        '/invites',
        { method: 'POST', body: JSON.stringify({}) }
      )
      Modal.success({
        title: '邀请码已生成',
        width: 480,
        content: (
          <div>
            <Typography.Paragraph>请复制并分享给受邀者（关闭后无法再次查看明文）：</Typography.Paragraph>
            <Typography.Paragraph copyable strong style={{ fontSize: 18 }}>
              {data.code}
            </Typography.Paragraph>
          </div>
        ),
      })
      await loadInviteLists()
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setInviteLoading(false)
    }
  }

  useEffect(() => {
    void hydrateFromRefresh()
  }, [hydrateFromRefresh])

  useEffect(() => {
    if (user && accessToken) {
      profileForm.setFieldsValue({
        displayName: user.displayName,
        avatarUrl: user.avatarUrl || '',
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

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: 12,
  }

  const checkServiceHealth = async () => {
    if (!baseUrl) return
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

  const onLogin = async () => {
    const v = await loginForm.validateFields()
    setLoading(true)
    try {
      await login(v.email, v.password)
      message.success('登录成功')
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setLoading(false)
    }
  }

  const onRegister = async () => {
    const v = await regForm.validateFields()
    setLoading(true)
    try {
      await register(v.email, v.password, v.displayName, v.inviteCode)
      message.success('注册成功')
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setLoading(false)
    }
  }

  const onBootstrapFirstUser = async () => {
    const v = await bootForm.validateFields()
    setLoading(true)
    try {
      await bootstrapFirstUser(v.secret, v.email, v.password, v.displayName)
      message.success('首个账号已创建并已登录')
      bootForm.resetFields()
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setLoading(false)
    }
  }

  const onSaveProfile = async () => {
    const v = await profileForm.validateFields()
    setLoading(true)
    try {
      await updateProfile({
        displayName: v.displayName,
        avatarUrl: v.avatarUrl === '' ? null : v.avatarUrl,
      })
      message.success('已保存')
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
      loginForm.resetFields()
      regForm.resetFields()
      pwdForm.resetFields()
      message.success('已退出')
    } finally {
      setLoading(false)
    }
  }

  const openExternal = (url: string) => {
    if (window.electronAPI?.openExternalLink) {
      void window.electronAPI.openExternalLink(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const apiWarning =
    !baseUrl ? (
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
            <Typography.Text code>.env.development</Typography.Text>，或未配置时自动使用{' '}
            <Typography.Text code>http://localhost:3847</Typography.Text>。
          </>
        }
      />
    ) : null

  if (isHydrating && !user && !accessToken) {
    return (
      <div className="app-tab-panel user-center-auth-page">
        {apiWarning}
        <div className="user-center-auth-layout">
          <div className="user-center-auth-panel user-center-auth-panel--idle">
            <Spin tip="正在恢复登录…" />
          </div>
        </div>
      </div>
    )
  }

  if (user && accessToken) {
    return (
      <div className="app-tab-panel user-center-root" style={{ padding: 24, overflow: 'auto' }}>
        {apiWarning}
        <Row gutter={[16, 16]} justify="center">
          <Col xs={24} lg={18} xl={14}>
            <Tabs
              defaultActiveKey="profile"
              onChange={(key) => {
                if (key === 'invites') void loadInviteLists()
              }}
              items={[
                {
                  key: 'profile',
                  label: (
                    <span>
                      <UserOutlined /> 个人信息
                    </span>
                  ),
                  children: (
                    <Card title="资料与展示" style={cardStyle}>
                      <Space align="center" size="large" wrap className="user-center-profile-header">
                        <Avatar size={72} src={user.avatarUrl || undefined} icon={<UserOutlined />} />
                        <div>
                          <Typography.Title level={5} style={{ marginTop: 0 }}>
                            {user.displayName}
                          </Typography.Title>
                          <Typography.Text type="secondary">{desensitizeEmail(user.email)}</Typography.Text>
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
                        <Form.Item name="avatarUrl" label="头像 URL" rules={[{ max: 512, message: '最长 512 字符' }]}>
                          <Input placeholder="https://…" allowClear />
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
                  ),
                },
                {
                  key: 'security',
                  label: (
                    <span>
                      <SafetyOutlined /> 账号安全
                    </span>
                  ),
                  children: (
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
                  ),
                },
                {
                  key: 'invites',
                  label: (
                    <span>
                      <TeamOutlined /> 我的邀请
                    </span>
                  ),
                  children: (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <Card title="生成邀请码" style={cardStyle}>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 16, textAlign: 'center' }}>
                          邀请码仅创建时显示一次，请妥善复制分享。受邀者注册时需填写完整邀请码。
                        </Typography.Paragraph>
                        <div className="user-center-actions-row">
                          <Button type="primary" size="large" loading={inviteLoading} onClick={() => void onCreateInvite()}>
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
                  ),
                },
                {
                  key: 'about',
                  label: (
                    <span>
                      <InfoCircleOutlined /> 关于与服务
                    </span>
                  ),
                  children: (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <Card title="认证服务" style={cardStyle} extra={<CloudOutlined />}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Typography.Text type="secondary">API 地址</Typography.Text>
                          <Typography.Paragraph code copyable style={{ marginBottom: 8 }}>
                            {baseUrl}
                          </Typography.Paragraph>
                          <Space wrap>
                            <Button onClick={() => void checkServiceHealth()} loading={healthChecking}>
                              检测连接
                            </Button>
                            {healthOk === true && <Tag color="success">服务可达</Tag>}
                            {healthOk === false && <Tag color="error">不可达</Tag>}
                            {healthOk === null && <Tag>未检测</Tag>}
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
                  ),
                },
              ]}
            />
          </Col>
        </Row>
      </div>
    )
  }

  return (
    <div className="app-tab-panel user-center-auth-page">
      {apiWarning}
      <div className="user-center-auth-layout">
        <div className="user-center-auth-panel">
          <header className="user-center-auth-header">
            <div className="user-center-auth-brand" aria-hidden>
              <UserOutlined />
            </div>
            <div className="user-center-auth-header-text">
              <h1 className="user-center-auth-title">用户中心</h1>
              <p className="user-center-auth-lead">登录或注册，以使用账号与邀请等功能</p>
            </div>
          </header>

          <div className="user-center-auth-segment" role="tablist" aria-label="登录或注册">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'login'}
              className={`user-center-auth-segment__btn${authMode === 'login' ? ' is-active' : ''}`}
              onClick={() => setAuthMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === 'register'}
              className={`user-center-auth-segment__btn${authMode === 'register' ? ' is-active' : ''}`}
              onClick={() => setAuthMode('register')}
            >
              注册
            </button>
          </div>

          {authMode === 'login' ? (
            <Form
              form={loginForm}
              layout="vertical"
              className="user-center-auth-form"
              requiredMark="optional"
              onFinish={() => void onLogin()}
            >
              <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
                <EmailAutoComplete
                  autoComplete="email"
                  size="large"
                  placeholder="输入用户名，或完整邮箱；可从下拉选择常用后缀"
                />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, min: 8, message: '至少 8 位' }]}>
                <Input.Password autoComplete="current-password" size="large" placeholder="至少 8 位" />
              </Form.Item>
              <Form.Item className="user-center-auth-form__actions">
                <Button type="primary" htmlType="submit" size="large" block loading={loading} className="user-center-auth-submit">
                  登录
                </Button>
                <div className="user-center-auth-secondary">
                  {resetUrl ? (
                    <button type="button" className="user-center-auth-link-btn" onClick={() => openExternal(resetUrl)}>
                      忘记密码？
                    </button>
                  ) : (
                    <span className="user-center-auth-hint">可在 .env 中配置 VITE_PASSWORD_RESET_URL 以显示找回入口</span>
                  )}
                </div>
              </Form.Item>
            </Form>
          ) : (
            <>
              <Form
                form={regForm}
                layout="vertical"
                className="user-center-auth-form"
                requiredMark="optional"
                onFinish={() => void onRegister()}
              >
                <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
                  <EmailAutoComplete
                    autoComplete="email"
                    size="large"
                    placeholder="输入用户名，或完整邮箱；可从下拉选择常用后缀"
                  />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={[{ required: true, min: 8, message: '至少 8 位' }]}>
                  <Input.Password autoComplete="new-password" size="large" placeholder="至少 8 位" />
                </Form.Item>
                <Form.Item
                  name="inviteCode"
                  label="邀请码"
                  extra={
                    <span className="user-center-auth-field-hint">
                      须由已注册用户分享。生产环境通常必填；若服务端开启 ALLOW_OPEN_REGISTRATION 可不填。
                    </span>
                  }
                >
                  <Input placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" size="large" />
                </Form.Item>
                <Form.Item name="displayName" label="昵称" tooltip="选填，可随时在个人资料中修改">
                  <Input size="large" placeholder="选填" />
                </Form.Item>
                <Form.Item className="user-center-auth-form__actions">
                  <Button type="primary" htmlType="submit" size="large" block loading={loading} className="user-center-auth-submit">
                    创建账号
                  </Button>
                </Form.Item>
              </Form>
              {import.meta.env.DEV ? (
                <Collapse ghost style={{ marginTop: 8 }}>
                  <Collapse.Panel
                    header="首个账号（冷启动）"
                    key="bootstrap"
                    extra={<Typography.Text type="secondary">库中无任何用户时</Typography.Text>}
                  >
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                      对应后端 <Typography.Text code>POST /auth/bootstrap-first-user</Typography.Text>：请在{' '}
                      <Typography.Text code>backend/.env</Typography.Text> 中配置{' '}
                      <Typography.Text code>BOOTSTRAP_INVITE_SECRET</Typography.Text>（≥16 字符），下方密钥与该值完全一致。
                    </Typography.Paragraph>
                    <Form
                      form={bootForm}
                      layout="vertical"
                      className="user-center-auth-form"
                      requiredMark="optional"
                      onFinish={() => void onBootstrapFirstUser()}
                    >
                      <Form.Item
                        name="secret"
                        label="引导密钥"
                        rules={[{ required: true, min: 16, message: '至少 16 字符，与后端 BOOTSTRAP_INVITE_SECRET 一致' }]}
                      >
                        <Input.Password autoComplete="off" size="large" placeholder="BOOTSTRAP_INVITE_SECRET" />
                      </Form.Item>
                      <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
                        <EmailAutoComplete autoComplete="email" size="large" placeholder="用户名或完整邮箱，下拉可选后缀" />
                      </Form.Item>
                      <Form.Item name="password" label="密码" rules={[{ required: true, min: 8, message: '至少 8 位' }]}>
                        <Input.Password autoComplete="new-password" size="large" />
                      </Form.Item>
                      <Form.Item name="displayName" label="昵称">
                        <Input size="large" placeholder="选填" />
                      </Form.Item>
                      <Form.Item style={{ marginBottom: 0 }}>
                        <Button type="default" htmlType="submit" size="large" block loading={loading}>
                          创建首个账号并登录
                        </Button>
                      </Form.Item>
                    </Form>
                  </Collapse.Panel>
                </Collapse>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserCenter
