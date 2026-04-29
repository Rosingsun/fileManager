import React from 'react'
import { Layout, Typography, Space, Tabs } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'

const { Header } = Layout
const { Title } = Typography

interface AppHeaderProps {
  activeTab: string
  onTabChange: (key: string) => void
}

const AppHeader: React.FC<AppHeaderProps> = ({ activeTab, onTabChange }) => {
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
        ]}
      />
    </Header>
  )
}

export default AppHeader

