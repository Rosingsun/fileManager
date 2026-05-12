import React from 'react'
import { Layout, Typography, Space, Tabs, Button, Tooltip } from 'antd'
import { FolderOpenOutlined, UserOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores'

const { Header } = Layout
const { Title } = Typography

interface AppHeaderProps {
  activeTab: string
  onTabChange: (key: string) => void
}

const AppHeader: React.FC<AppHeaderProps> = ({ activeTab, onTabChange }) => {
  const isLoggedIn = useAuthStore((s) => !!(s.user && s.accessToken))

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
        <Tabs
          activeKey={activeTab}
          onChange={onTabChange}
          className="header-tabs"
          items={[
            {
              key: 'organize',
              label: '文件整理',
            },
            {
              key: 'similarity',
              label: '相似照片检测',
            },
            {
              key: 'classify',
              label: '图片分类',
            },
            {
              key: 'tools',
              label: '实用工具',
            },
            {
              key: 'quickFilter',
              label: '快速筛选',
            },
            {
              key: 'user',
              label: (
                <span className="header-tab-user">
                  <UserOutlined />
                  用户中心
                </span>
              ),
            },
          ]}
        />
        <Tooltip title={isLoggedIn ? '账号与设置（已登录）' : '登录 / 注册'}>
          <Button
            type={activeTab === 'user' ? 'primary' : 'default'}
            className="header-user-entry"
            icon={<UserOutlined />}
            aria-label="打开用户中心"
            onClick={() => onTabChange('user')}
          >
            用户中心
          </Button>
        </Tooltip>
      </div>
    </Header>
  )
}

export default AppHeader

