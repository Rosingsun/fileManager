import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Layout, Alert, Spin, message } from 'antd'
import FileTree from './components/FileTree'
import FileList from './components/FileList'
import ControlPanel from './components/ControlPanel'
import AppHeader from './components/AppHeader'
import SimilarityDetection from './components/SimilarityDetection/SimilarityDetection'
import ImageClassification from './components/ImageClassification/ImageClassification'
import ToolsEntry from './components/Tools/ToolsEntry'
import { QuickFilter, UserCenter, UserAuthPanel, CosLibrarySummaryCard, CosImageLibraryTab } from './components'
import './styles/App.css'
import { useAuthStore, useFileStore } from './stores'
import { isAuthApiConfigured } from './utils'
import type { UserCenterAppNavigate } from './components/UserCenter/userCenterShared'

const { Content } = Layout

const App: React.FC = () => {
  const [electronAPIStatus, setElectronAPIStatus] = useState<'checking' | 'available' | 'unavailable'>('checking')
  const [activeTab, setActiveTab] = useState<string>('organize')
  const [organizeCenterMode, setOrganizeCenterMode] = useState<'local' | 'cloud'>('local')
  const [cosStatsNonce, setCosStatsNonce] = useState(0)
  const [userCenterFocusTab, setUserCenterFocusTab] = useState<string | null>(null)

  const hydrateFromRefresh = useAuthStore((s) => s.hydrateFromRefresh)
  const isHydrating = useAuthStore((s) => s.isHydrating)
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)
  const tryRefresh = useAuthStore((s) => s.tryRefresh)
  const fetchProfile = useAuthStore((s) => s.fetchProfile)

  const hasAuthBase = isAuthApiConfigured()
  const isAuthenticated = !!(user && accessToken)

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

    checkElectronAPI()

    const timer = setTimeout(checkElectronAPI, 2000)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    void hydrateFromRefresh()
  }, [hydrateFromRefresh])

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveTab('user')
    }
  }, [isAuthenticated])

  const profileFetchedRef = useRef(false)
  useEffect(() => {
    if (!isAuthenticated) {
      profileFetchedRef.current = false
      return
    }
    if (profileFetchedRef.current) return
    profileFetchedRef.current = true
    void fetchProfile()
  }, [isAuthenticated, fetchProfile])

  useEffect(() => {
    void window.electronAPI?.setCurrentUserId?.(user?.id ?? null)
    return () => {
      void window.electronAPI?.setCurrentUserId?.(null)
    }
  }, [user?.id])

  useEffect(() => {
    if (!isAuthenticated || !hasAuthBase) return
    let last = 0
    const throttleMs = 60_000
    const run = () => {
      const now = Date.now()
      if (now - last < throttleMs) return
      last = now
      void tryRefresh()
    }
    const onFocus = () => run()
    const onVis = () => {
      if (document.visibilityState === 'visible') run()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    const interval = window.setInterval(() => {
      void tryRefresh()
    }, 12 * 60 * 60 * 1000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(interval)
    }
  }, [isAuthenticated, hasAuthBase, tryRefresh])

  const handleTabChange = useCallback(
    (key: string) => {
      if (!isAuthenticated && key !== 'user') {
        message.warning('请先登录')
        setActiveTab('user')
        return
      }
      if (key !== 'organize') {
        setOrganizeCenterMode('local')
      }
      setActiveTab(key)
    },
    [isAuthenticated]
  )

  const handleUserCenterNavigate = useCallback((target: UserCenterAppNavigate) => {
    if (target.type === 'organizePath') {
      useFileStore.getState().setCurrentPath(target.path)
      setOrganizeCenterMode('local')
      setActiveTab('organize')
      return
    }
    if (target.tab === 'organize') {
      setOrganizeCenterMode(target.organizeMode ?? 'local')
    } else {
      setOrganizeCenterMode('local')
    }
    setActiveTab(target.tab)
  }, [])

  if (hasAuthBase && isHydrating) {
    return (
      <Layout className="app-layout">
        <Content className="app-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" tip="正在恢复登录…" />
        </Content>
      </Layout>
    )
  }

  if (!isAuthenticated) {
    return (
      <Layout className="app-layout">
        <AppHeader activeTab={activeTab} onTabChange={handleTabChange} authenticated={false} />
        {electronAPIStatus === 'unavailable' && (
          <Alert
            className="app-inline-notice"
            message="Electron API 未初始化"
            description="请确保在 Electron 环境中运行。如果问题持续，请检查预加载脚本是否正确加载。"
            type="error"
            showIcon
            closable
          />
        )}
        <Content className="app-content">
          <UserAuthPanel />
        </Content>
      </Layout>
    )
  }

  return (
    <Layout className="app-layout">
      <AppHeader activeTab={activeTab} onTabChange={handleTabChange} authenticated />
      {electronAPIStatus === 'unavailable' && (
        <Alert
          className="app-inline-notice"
          message="Electron API 未初始化"
          description="请确保在 Electron 环境中运行。如果问题持续，请检查预加载脚本是否正确加载。"
          type="error"
          showIcon
          closable
        />
      )}
      <Content className="app-content">
        {activeTab === 'organize' && (
          <div className="app-main">
            <div className="app-sidebar">
              <CosLibrarySummaryCard
                onOpen={() => setOrganizeCenterMode('cloud')}
                refreshNonce={cosStatsNonce}
              />
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <FileTree />
              </div>
            </div>
            <div className="app-center">
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {organizeCenterMode === 'local' ? (
                  <FileList />
                ) : (
                  <CosImageLibraryTab
                    embedded
                    onBackToLocalFiles={() => {
                      setOrganizeCenterMode('local')
                      setCosStatsNonce((n) => n + 1)
                    }}
                  />
                )}
              </div>
            </div>
            <div className="app-panel">
              <ControlPanel />
            </div>
          </div>
        )}
        {activeTab === 'similarity' && (
          <div className="app-tab-panel">
            <SimilarityDetection />
          </div>
        )}
        {activeTab === 'classify' && (
          <div className="app-tab-panel">
            <ImageClassification />
          </div>
        )}
        {activeTab === 'tools' && (
          <div className="app-tab-panel" style={{ overflow: 'hidden' }}>
            <ToolsEntry />
          </div>
        )}
        {activeTab === 'quickFilter' && (
          <div className="app-tab-panel">
            <QuickFilter />
          </div>
        )}
        {activeTab === 'user' && (
          <UserCenter
            focusTab={userCenterFocusTab}
            onFocusTabConsumed={() => setUserCenterFocusTab(null)}
            onNavigateApp={handleUserCenterNavigate}
          />
        )}
      </Content>
    </Layout>
  )
}

export default App
