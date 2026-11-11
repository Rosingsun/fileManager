import React from 'react'
import ReactDOM from 'react-dom/client'
import ThemedApp from './ThemedApp'
import './styles/index.css'
import { readStoredPreference, resolveThemeFromPreference } from './stores'

const checkElectronAPI = (): Promise<boolean> => {
  if (typeof window === 'undefined' || window.electronAPI) {
    return Promise.resolve(!!window.electronAPI)
  }
  
  return new Promise((resolve) => {
    let attempts = 0
    const maxAttempts = 50
    
    const checkInterval = setInterval(() => {
      if (window.electronAPI || ++attempts >= maxAttempts) {
        clearInterval(checkInterval)
        resolve(!!window.electronAPI)
      }
    }, 100)
  })
}

const renderError = (message: string) => {
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#f5f5f5;font-family:sans-serif">
        <div style="background:white;padding:40px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);max-width:500px;text-align:center">
          <h1 style="color:#ff4d4f;margin-bottom:20px">⚠️ Electron API 初始化失败</h1>
          <p style="font-size:16px;line-height:1.6">${message}</p>
        </div>
      </div>
    `
  }
}

checkElectronAPI().then((isAvailable) => {
  if (!isAvailable) {
    renderError('Electron API 未初始化，请确保在 Electron 环境中运行')
    return
  }
  
  const initialTheme = resolveThemeFromPreference(readStoredPreference())
  document.documentElement.setAttribute('data-app-theme', initialTheme)

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemedApp />
    </React.StrictMode>
  )
})

