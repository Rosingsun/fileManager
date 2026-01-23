import React, { useEffect, useState } from 'react'
import { Layout, Alert } from 'antd'
import FileTree from './components/FileTree'
import FileList from './components/FileList'
import ControlPanel from './components/ControlPanel'
import AppHeader from './components/AppHeader'
import SimilarityDetection from './components/SimilarityDetection/SimilarityDetection'
import './styles/App.css'

const { Content } = Layout

const App: React.FC = () => {
  const [electronAPIStatus, setElectronAPIStatus] = useState<'checking' | 'available' | 'unavailable'>('checking')
  const [activeTab, setActiveTab] = useState<string>('organize')

  useEffect(() => {
    const checkElectronAPI = () => {
      if (window.electronAPI) {
        setElectronAPIStatus('available')
        console.log('React: electronAPI is available', window.electronAPI)
      } else {
        setElectronAPIStatus('unavailable')
        console.warn('React: electronAPI is not available')
      }
    }

    // 立即检查
    checkElectronAPI()
    
    // 延迟检查（给preload脚本更多时间）
    const timer = setTimeout(checkElectronAPI, 2000)
    
    return () => clearTimeout(timer)
  }, [])

  return (
    <Layout className="app-layout">
      <AppHeader activeTab={activeTab} onTabChange={setActiveTab} />
      {electronAPIStatus === 'unavailable' && (
        <Alert
          message="Electron API 未初始化"
          description="请确保在 Electron 环境中运行。如果问题持续，请检查预加载脚本是否正确加载。"
          type="error"
          showIcon
          closable
          style={{ margin: '16px' }}
        />
      )}
      <Content className="app-content">
        {activeTab === 'organize' && (
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
        )}
        {activeTab === 'similarity' && (
          <div style={{ padding: '2px', height: '100%', overflow: 'scroll' }}>
            <SimilarityDetection />
          </div>
        )}
      </Content>
    </Layout>
  )
}

export default App

