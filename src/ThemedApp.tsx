import React, { useEffect } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AppRoot from './App'
import { TooltipProvider } from './components/ui/tooltip'
import { getAntAppTheme } from './utils'
import { subscribeSystemTheme, useThemeStore } from './stores'

const ThemedApp: React.FC = () => {
  const preference = useThemeStore((s) => s.preference)
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)
  const syncResolvedTheme = useThemeStore((s) => s.syncResolvedTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-app-theme', resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (preference !== 'system') return
    return subscribeSystemTheme(syncResolvedTheme)
  }, [preference, syncResolvedTheme])

  return (
    <ConfigProvider locale={zhCN} theme={getAntAppTheme(resolvedTheme)}>
      <AntdApp>
        <TooltipProvider>
          <AppRoot />
        </TooltipProvider>
      </AntdApp>
    </ConfigProvider>
  )
}

export default ThemedApp
