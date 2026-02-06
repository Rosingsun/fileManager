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
        <FolderOpenOutlined style={{ fontSize: 24, color: '#fff' }} />
        <Title level={4} style={{ margin: 0, color: '#fff' }}>
          文件整理工具 v1.0
        </Title>
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
        ]}
      />
    </Header>
  )
}

export default AppHeader

