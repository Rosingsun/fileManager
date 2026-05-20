import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Col,
  Collapse,
  Descriptions,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd'
import {
  ApiOutlined,
  AppstoreOutlined,
  CloudOutlined,
  CopyOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  QuestionCircleOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import {
  AuthApiError,
  cosImageStats,
  formatAuthApiError,
  getAuthApiBaseUrl,
  isAuthApiConfigured,
} from '../../utils'
import { GlassCard, PageSection } from '../UnifiedUI'

const { Text, Paragraph } = Typography

const APP_FEATURES = [
  {
    key: 'organize',
    label: '文件整理',
    icon: <FolderOpenOutlined />,
    accent: '#0a84ff',
    desc: '按类型、日期、大小或自定义规则分类，支持预览与冲突处理',
  },
  {
    key: 'similarity',
    label: '相似照片',
    icon: <CopyOutlined />,
    accent: '#7c5cff',
    desc: '感知哈希检测重复与相似图片，分组展示便于清理',
  },
  {
    key: 'classify',
    label: 'AI 分类',
    icon: <PictureOutlined />,
    accent: '#30b95a',
    desc: 'CLIP / MobileNet 等引擎，九大类内容识别与筛选',
  },
  {
    key: 'cloud',
    label: '云图库',
    icon: <CloudOutlined />,
    accent: '#5ac8fa',
    desc: '图片上传至腾讯云 COS，预签名预览与账号隔离存储',
  },
  {
    key: 'tools',
    label: '实用工具',
    icon: <ToolOutlined />,
    accent: '#ff9f0a',
    desc: '图片编辑、格式转换、批量处理等辅助能力',
  },
] as const

const FAQ_ITEMS = [
  {
    key: 'cos',
    label: '云图库显示「未配置」怎么办？',
    children: (
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        需由管理员在数据库 <Text code>app_parameters</Text> 中配置腾讯云 COS 相关参数，或通过{' '}
        <Text code>POST /admin/parameters/cos</Text> 写入后重启认证 API。存储桶还需在腾讯云控制台配置 CORS，允许本应用来源的
        PUT/GET。配置完成后，在本页点击「刷新服务状态」或重新进入云图库即可。
      </Paragraph>
    ),
  },
  {
    key: 'api',
    label: '认证 API 不可达如何排查？',
    children: (
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        确认本机或内网可访问上方显示的 API 地址；开发环境默认{' '}
        <Text code>http://localhost:3847</Text>，需先执行 <Text code>npm run dev:auth-api</Text>。生产构建请在{' '}
        <Text code>.env.production</Text> 中设置 <Text code>VITE_AUTH_API_BASE_URL</Text>（无尾部斜杠）。
      </Paragraph>
    ),
  },
  {
    key: 'data',
    label: '哪些数据存在本机，哪些在云端？',
    children: (
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        访问历史、图片编辑预设、界面主题等偏好保存在当前设备；账号资料、操作日志、云图库图片与配额由认证服务与对象存储管理。退出登录不会删除本机整理记录，但云端内容需登录同一账号访问。
      </Paragraph>
    ),
  },
  {
    key: 'log',
    label: '如何查看我的操作记录？',
    children: (
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        在左侧进入「操作日志」可浏览按时间排序的登录、整理、上传等行为；「使用统计」提供按能力分类的汇总与最近使用时间。
      </Paragraph>
    ),
  },
]

function formatPlatformLabel(platform: string): string {
  const map: Record<string, string> = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux',
  }
  return map[platform] ?? platform
}

const UserCenterAboutTab: React.FC = () => {
  const { message } = App.useApp()
  const baseUrl = getAuthApiBaseUrl()
  const apiDisplayLabel = baseUrl || '—'
  const apiConfigured = isAuthApiConfigured()

  const [about, setAbout] = useState<{ version: string; platform: string } | null>(null)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [healthChecking, setHealthChecking] = useState(false)
  const [cosConfigured, setCosConfigured] = useState<boolean | null>(null)
  const [cosChecking, setCosChecking] = useState(false)

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.getAppVersion || !api.getPlatform) return
    void Promise.all([api.getAppVersion(), api.getPlatform()]).then(([version, platform]) => {
      setAbout({ version, platform })
    })
  }, [])

  const checkCosStatus = useCallback(async () => {
    setCosChecking(true)
    try {
      await cosImageStats()
      setCosConfigured(true)
    } catch (e) {
      setCosConfigured(e instanceof AuthApiError && e.code === 'COS_NOT_CONFIGURED' ? false : null)
      if (!(e instanceof AuthApiError && e.code === 'COS_NOT_CONFIGURED')) {
        message.error(formatAuthApiError(e))
      }
    } finally {
      setCosChecking(false)
    }
  }, [message])

  const checkServiceHealth = useCallback(async () => {
    if (!apiConfigured) return
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
  }, [apiConfigured, baseUrl])

  const refreshAllStatus = useCallback(async () => {
    await Promise.all([checkServiceHealth(), checkCosStatus()])
  }, [checkServiceHealth, checkCosStatus])

  useEffect(() => {
    void refreshAllStatus()
  }, [refreshAllStatus])

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <PageSection
        title="关于与服务"
        subtitle="应用信息、后端连通性与云存储状态；常见问题与排障指引"
      >
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          本页汇总客户端版本、认证 API 与对象存储状态，并提供能力说明与排障指引。若云图库或登录异常，可先刷新服务状态后查阅下方常见问题。
        </Paragraph>
      </PageSection>

      <GlassCard title="关于本应用" extra={<AppstoreOutlined />} loading={!about}>
        {about ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions
              size="small"
              column={{ xs: 1, sm: 2 }}
              items={[
                { key: 'name', label: '应用名称', children: '文件整理工具' },
                { key: 'version', label: '当前版本', children: <Text strong>{about.version}</Text> },
                {
                  key: 'platform',
                  label: '运行平台',
                  children: formatPlatformLabel(about.platform),
                },
                { key: 'stack', label: '技术栈', children: 'Electron · React · TypeScript' },
              ]}
            />
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              跨平台桌面文件整理与图片管理能力：本地目录浏览、智能分类整理、相似图检测、AI 内容识别、图片编辑，以及可选的云端图库同步。整理与预览以本机文件系统为主，登录后可使用账号级云图库与操作审计。
            </Paragraph>
          </Space>
        ) : null}
      </GlassCard>

      <PageSection title="核心能力" subtitle="登录账号后可使用云图库与操作日志等云端能力">
        <Row gutter={[12, 12]}>
          {APP_FEATURES.map((f) => (
            <Col xs={24} sm={12} key={f.key}>
              <div className="user-center-about-feature">
                <div className="user-center-about-feature__head">
                  <span
                    className="user-center-about-feature__icon"
                    style={{ color: f.accent, background: `${f.accent}18` }}
                    aria-hidden
                  >
                    {f.icon}
                  </span>
                  <Text strong>{f.label}</Text>
                </div>
                <Text type="secondary" className="user-center-about-feature__desc">
                  {f.desc}
                </Text>
              </div>
            </Col>
          ))}
        </Row>
      </PageSection>

      <GlassCard
        title="认证与云服务"
        extra={<ApiOutlined />}
        actions={[
          <Button key="refresh" size="small" loading={healthChecking || cosChecking} onClick={() => void refreshAllStatus()}>
            刷新服务状态
          </Button>,
        ]}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {!apiConfigured ? (
            <Alert
              type="warning"
              showIcon
              message="未检测到认证服务地址"
              description={
                <>
                  请在 <Text code>.env.development</Text> 或 <Text code>.env.production</Text> 中配置{' '}
                  <Text code>VITE_AUTH_API_BASE_URL</Text>，与后端部署地址一致（无尾部斜杠）。
                </>
              }
            />
          ) : null}
          <div>
            <Text type="secondary">API 地址</Text>
            <Paragraph code copyable style={{ marginBottom: 0, marginTop: 4 }}>
              {apiDisplayLabel}
            </Paragraph>
          </div>
          <Space wrap>
            <Button onClick={() => void checkServiceHealth()} loading={healthChecking} disabled={!apiConfigured}>
              检测认证 API
            </Button>
            {healthOk === true && <Tag color="success">认证 API 可达</Tag>}
            {healthOk === false && <Tag color="error">认证 API 不可达</Tag>}
            {healthOk === null && !healthChecking && <Tag>认证 API 未检测</Tag>}
            {cosConfigured === true && <Tag color="success">COS 已配置</Tag>}
            {cosConfigured === false && <Tag color="default">COS 未配置</Tag>}
            {cosConfigured === null && !cosChecking && <Tag>COS 状态未知</Tag>}
          </Space>
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13 }}>
            认证服务负责登录、资料、邀请码、操作日志与云图库配额；对象存储（COS）由服务端统一配置，各用户数据按账号路径隔离。头像与云图库图片通过短时预签名 URL 访问，不在客户端长期保存密钥。
          </Paragraph>
        </Space>
      </GlassCard>

      <PageSection title="常见问题" subtitle="连接、云图库与数据说明" extra={<QuestionCircleOutlined />}>
        <Collapse
          ghost
          items={FAQ_ITEMS.map((item) => ({
            key: item.key,
            label: item.label,
            children: item.children,
          }))}
        />
      </PageSection>

      <GlassCard title="安全与隐私" extra={<InfoCircleOutlined />}>
        <ul className="user-center-about-list">
          <li>密码仅以哈希形式存于服务端，客户端不记录明文令牌于日志。</li>
          <li>本机访问历史与编辑预设默认不随账号同步；清理应用数据前请自行备份重要目录。</li>
          <li>云图库删除、文件夹移动等操作会写入操作日志，便于您回溯与审计。</li>
          <li>修改登录密码后将清除所有设备会话，需使用新密码重新登录。</li>
        </ul>
        <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 12, fontSize: 12 }}>
          详细部署与 API 说明请参阅项目文档 <Text code>DEVELOPMENT.md</Text>；问题反馈请联系管理员或运维。
        </Paragraph>
      </GlassCard>
    </Space>
  )
}

export default UserCenterAboutTab
