import React, { useMemo } from 'react'
import { Layout, Typography, Space, Tabs, Popover, Divider } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores'
import UserAvatar from './UserAvatar'

const { Header } = Layout
const { Title, Text } = Typography

interface AppHeaderProps {
  activeTab: string
  onTabChange: (key: string) => void
  /** 未登录时禁用除「用户中心」外的 Tab */
  authenticated?: boolean
}

function resolveDisplayName(email: string, displayName?: string | null): string {
  const trimmed = displayName?.trim()
  if (trimmed) return trimmed
  const at = email.indexOf('@')
  return at > 0 ? email.slice(0, at) : email
}

const AppHeader: React.FC<AppHeaderProps> = ({ activeTab, onTabChange, authenticated = true }) => {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const isLoggedIn = !!(user && accessToken)

  const displayLabel = useMemo(() => {
    if (!isLoggedIn || !user) return '登录'
    return resolveDisplayName(user.email, user.displayName)
  }, [isLoggedIn, user])

  const tabItems = [
    { key: 'organize', label: '文件整理' },
    { key: 'similarity', label: '相似照片检测' },
    { key: 'classify', label: '图片分类' },
    { key: 'tools', label: '实用工具' },
    { key: 'quickFilter', label: '快速筛选' },
  ].map((item) => ({
    ...item,
    disabled: !authenticated,
  }))

  const tabsActiveKey = tabItems.some((t) => t.key === activeTab) ? activeTab : undefined

  const userPopover = isLoggedIn && user ? (
    <div className="header-user-popover">
      <div className="header-user-popover-head">
        <UserAvatar size={48} avatarUrl={user.avatarUrl} />
        <div className="header-user-popover-meta">
          <Text strong className="header-user-popover-name">
            {user.displayName?.trim() || '未设置昵称'}
          </Text>
          <Text type="secondary" className="header-user-popover-email">
            {user.email}
          </Text>
        </div>
      </div>
      <Divider style={{ margin: '10px 0' }} />
      <Text type="secondary" className="header-user-popover-hint">
        点击进入个人中心
      </Text>
    </div>
  ) : (
    <div className="header-user-popover">
      <Text>尚未登录</Text>
      <Text type="secondary" className="header-user-popover-hint">
        点击登录或注册账号
      </Text>
    </div>
  )

  return (
    <Header className="app-header">
      <Space className="header-left">
        <span className="header-brand">
          <FolderOpenOutlined style={{ fontSize: 20 }} />
        </span>
        <span className="header-title">
          <Title level={4} style={{ margin: 0, color: 'var(--app-text-primary)' }}>
            文件整理工具
          </Title>
          <span className="header-title-meta">统一文件管理、图片处理与智能分类</span>
        </span>
      </Space>
      <div className="header-tabs-wrap">
        <Tabs activeKey={tabsActiveKey} onChange={onTabChange} className="header-tabs" items={tabItems} />
        <Popover
          content={userPopover}
          trigger="hover"
          mouseEnterDelay={0.2}
          placement="bottomRight"
          overlayClassName="header-user-popover-overlay"
        >
          <button
            type="button"
            className={`header-user-profile${activeTab === 'user' ? ' header-user-profile--active' : ''}`}
            aria-label={isLoggedIn ? '打开个人中心' : '登录或注册'}
            onClick={() => onTabChange('user')}
          >
            <UserAvatar
              size={32}
              avatarUrl={isLoggedIn ? user?.avatarUrl : null}
              className="header-user-profile-avatar"
            />
            <span className="header-user-profile-name">{displayLabel}</span>
          </button>
        </Popover>
      </div>
    </Header>
  )
}

export default AppHeader

