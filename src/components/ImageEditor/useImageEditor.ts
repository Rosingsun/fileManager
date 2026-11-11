import { useCallback, useMemo, useState } from 'react'
import type { ImageEditSettings } from '../../types'

/**
 * 编辑参数状态。
 * 所有更新函数都用 useCallback 固定引用，批量更新通过 updateSettings 一次 setState 完成，
 * 避免多键同时变更时触发多次渲染。
 */
export function useImageEditor(initial?: ImageEditSettings) {
  const [settings, setSettings] = useState<ImageEditSettings>(() => initial ?? {})

  const updateSetting = useCallback(
    (key: keyof ImageEditSettings, value: ImageEditSettings[keyof ImageEditSettings]) => {
      setSettings(prev => ({ ...prev, [key]: value }))
    },
    []
  )

  const updateSettings = useCallback((updates: Partial<ImageEditSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings({})
  }, [])

  return useMemo(
    () => ({ settings, setSettings, updateSetting, updateSettings, resetSettings }),
    [settings, updateSetting, updateSettings, resetSettings]
  )
}
