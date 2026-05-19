import React, { useState } from 'react'
import { Form, Input, Button, Typography, Alert, Collapse, App } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores'
import { formatAuthApiError, getPasswordResetUrl, isAuthApiConfigured } from '../utils'
import EmailAutoComplete from './EmailAutoComplete'

const UserAuthPanel: React.FC = () => {
  const { message } = App.useApp()
  const resetUrl = getPasswordResetUrl()

  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const bootstrapFirstUser = useAuthStore((s) => s.bootstrapFirstUser)

  const [loginForm] = Form.useForm()
  const [regForm] = Form.useForm()
  const [bootForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  const onLogin = async () => {
    if (loading) return
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
    if (loading) return
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
    if (loading) return
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

  const openExternal = (url: string) => {
    if (window.electronAPI?.openExternalLink) {
      void window.electronAPI.openExternalLink(url)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
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
              <p className="user-center-auth-lead">登录或注册，以使用账号与文件整理等功能</p>
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

export default UserAuthPanel
