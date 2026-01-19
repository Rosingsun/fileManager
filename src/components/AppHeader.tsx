import React from 'react'
import { Layout, Typography, Space } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'

const { Header } = Layout
const { Title } = Typography

const AppHeader: React.FC = () => {
  return (
    <Header className="app-header">
      <Space>
        <FolderOpenOutlined style={{ fontSize: 24, color: '#1890ff' }} />
        <Title level={4} style={{ margin: 0, color: '#fff' }}>
          文件整理工具 v1.0
        </Title>
      </Space>
    </Header>
  )
}

export default AppHeader

