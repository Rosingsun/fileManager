import React from 'react'
import { Layout } from 'antd'
import FileTree from './components/FileTree'
import FileList from './components/FileList'
import ControlPanel from './components/ControlPanel'
import AppHeader from './components/AppHeader'
import './styles/App.css'

const { Content } = Layout

const App: React.FC = () => {
  return (
    <Layout className="app-layout">
      <AppHeader />
      <Content className="app-content">
        <div className="app-main">
          <div className="app-sidebar">
            <FileTree />
          </div>
          <div className="app-center">
            <FileList />
          </div>
          <div className="app-panel">
            <ControlPanel />
          </div>
        </div>
      </Content>
    </Layout>
  )
}

export default App

