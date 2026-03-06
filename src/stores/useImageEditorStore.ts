import { create } from 'zustand'
import type { ImagePreset } from '../types'

const PRESETS_STORAGE_KEY = 'filedeal_image_editor_presets'

const safeStorage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  },
  set: <T>(key: string, value: T): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }
}

interface ImageEditorState {
  presets: ImagePreset[]
  addPreset: (preset: Omit<ImagePreset, 'id'>) => void
  updatePreset: (id: string, updates: Partial<Omit<ImagePreset, 'id'>>) => void
  deletePreset: (id: string) => void
  loadPresets: () => void
}

export const useImageEditorStore = create<ImageEditorState>((set, get) => ({
  presets: safeStorage.get(PRESETS_STORAGE_KEY, []),
  addPreset: (preset) => {
    const newPreset: ImagePreset = { ...preset, id: Date.now().toString() }
    const presets = [...get().presets, newPreset]
    set({ presets })
    safeStorage.set(PRESETS_STORAGE_KEY, presets)
  },
  updatePreset: (id, updates) => {
    const presets = get().presets.map(p => p.id === id ? { ...p, ...updates } : p)
    set({ presets })
    safeStorage.set(PRESETS_STORAGE_KEY, presets)
  },
  deletePreset: (id) => {
    const presets = get().presets.filter(p => p.id !== id)
    set({ presets })
    safeStorage.set(PRESETS_STORAGE_KEY, presets)
  },
  loadPresets: () => {
    set({ presets: safeStorage.get(PRESETS_STORAGE_KEY, []) })
  }
}))
