import { useState } from 'react'
import type { ImageEditSettings } from '../../types'

export function useImageEditor(initial?: ImageEditSettings) {
  const [settings, setSettings] = useState<ImageEditSettings>(initial || {})

  const updateSetting = (key: keyof ImageEditSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const resetSettings = () => {
    setSettings({})
  }

  return {
    settings,
    setSettings,
    updateSetting,
    resetSettings
  }
}
