type ElectronApiKey = keyof NonNullable<Window['electronAPI']>

/**
 * 等待 window.electronAPI 出现；可选要求某方法存在（用于新 API 与旧 preload 兼容检测）。
 */
export function waitForElectronApiReady(options?: {
  requiredMethod?: ElectronApiKey
  maxAttempts?: number
  intervalMs?: number
}): Promise<boolean> {
  const { requiredMethod, maxAttempts = 50, intervalMs = 100 } = options ?? {}

  if (typeof window === 'undefined') {
    return Promise.resolve(false)
  }

  const isReady = (): boolean => {
    const api = window.electronAPI
    if (!api) return false
    if (!requiredMethod) return true
    return typeof api[requiredMethod] === 'function'
  }

  if (isReady()) return Promise.resolve(true)

  return new Promise(resolve => {
    let attempts = 0
    const id = setInterval(() => {
      if (isReady() || ++attempts >= maxAttempts) {
        clearInterval(id)
        resolve(isReady())
      }
    }, intervalMs)
  })
}

export function getElectronApiIssueMessage(requiredMethod: ElectronApiKey = 'scanImageQuality'): string {
  if (typeof window === 'undefined') {
    return '当前不在浏览器窗口环境中。'
  }
  if (!window.electronAPI) {
    return '未检测到 Electron 桥接：请使用「npm run dev」启动桌面应用，勿在普通浏览器中直接打开开发服务器地址。'
  }
  const api = window.electronAPI
  if (typeof api[requiredMethod] !== 'function') {
    return `预加载脚本未暴露「${String(requiredMethod)}」：请完全退出应用后重新执行 npm run dev（或 npm run build），确保 dist-electron/preload 已重新生成。`
  }
  return ''
}
