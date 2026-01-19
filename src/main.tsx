import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles/index.css'

// 检查 electronAPI 是否可用
function checkElectronAPI(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return Promise.resolve(false)
  }
  
  // 如果已经存在，直接返回
  if (window.electronAPI) {
    console.log('[Renderer] electronAPI 已可用')
    return Promise.resolve(true)
  }
  
  // 等待预加载脚本执行
  return new Promise<boolean>((resolve) => {
    let attempts = 0
    const maxAttempts = 50 // 最多等待 5 秒 (50 * 100ms)
    
    const checkInterval = setInterval(() => {
      attempts++
      
      if (window.electronAPI) {
        clearInterval(checkInterval)
        console.log('[Renderer] electronAPI 已加载')
        resolve(true)
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
        console.error('[Renderer] electronAPI 未在 5 秒内加载')
        console.error('[Renderer] 当前环境:', {
          userAgent: navigator.userAgent,
          location: window.location.href,
          hasWindow: typeof window !== 'undefined'
        })
        resolve(false)
      }
    }, 100)
  })
}

// 显示错误页面
function renderErrorPage(message: string) {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f5f5f5;
        color: #333;
      ">
        <div style="
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 600px;
          text-align: center;
        ">
          <h1 style="color: #ff4d4f; margin-bottom: 20px;">⚠️ Electron API 初始化失败</h1>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">${message}</p>
          <div style="
            background: #f0f0f0;
            padding: 15px;
            border-radius: 4px;
            text-align: left;
            font-family: monospace;
            font-size: 12px;
            margin-top: 20px;
          ">
            <strong>可能的原因：</strong><br>
            1. 预加载脚本未正确加载<br>
            2. 上下文隔离配置错误<br>
            3. 在非 Electron 环境中运行<br>
            4. 构建配置问题
          </div>
          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            请检查控制台日志以获取更多信息
          </p>
        </div>
      </div>
    `
  }
}

// 等待 electronAPI 加载后再渲染应用
checkElectronAPI().then((isAvailable) => {
  if (!isAvailable) {
    renderErrorPage('Electron API 未初始化，请确保在 Electron 环境中运行。如果问题持续，请检查预加载脚本是否正确加载。')
    return
  }
  
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ConfigProvider locale={zhCN}>
        <App />
      </ConfigProvider>
    </React.StrictMode>
  )
})

