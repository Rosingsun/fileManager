import { create } from 'zustand'
import type { ImagePreset, PresetGroup } from '../types'

const PRESETS_STORAGE_KEY = 'filedeal_image_editor_presets'
const GROUPS_STORAGE_KEY = 'filedeal_image_editor_groups'

const BUILTIN_SYSTEM_GROUP: PresetGroup = {
  id: 'system',
  name: '系统预设',
  isBuiltIn: true
}

const BUILTIN_UNGROUPED_GROUP: PresetGroup = {
  id: 'ungrouped',
  name: '未分组',
  isBuiltIn: false
}

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
  groups: PresetGroup[]
  selectedGroupId: string
  selectedPresetId: string | null
  addPreset: (preset: Omit<ImagePreset, 'id'>) => void
  updatePreset: (id: string, updates: Partial<Omit<ImagePreset, 'id'>>) => void
  deletePreset: (id: string) => void
  loadPresets: () => void
  addGroup: (group: Omit<PresetGroup, 'id' | 'isBuiltIn'>) => void
  updateGroup: (id: string, updates: Partial<Omit<PresetGroup, 'id' | 'isBuiltIn'>>) => void
  deleteGroup: (id: string) => void
  setSelectedGroup: (groupId: string) => void
  setSelectedPreset: (presetId: string | null) => void
}

const loadInitialGroups = (): PresetGroup[] => {
  const stored = safeStorage.get<PresetGroup[]>(GROUPS_STORAGE_KEY, [])
  const userGroups = stored.filter(g => g.id !== 'system' && g.id !== 'ungrouped')
  
  return [
    BUILTIN_SYSTEM_GROUP,
    BUILTIN_UNGROUPED_GROUP,
    ...userGroups
  ]
}

const loadInitialPresets = (): ImagePreset[] => {
  const stored = safeStorage.get<ImagePreset[]>(PRESETS_STORAGE_KEY, [])
  const migrated = stored.map(p => ({
    ...p,
    groupId: p.groupId || 'ungrouped'
  }))
  if (JSON.stringify(stored) !== JSON.stringify(migrated)) {
    safeStorage.set(PRESETS_STORAGE_KEY, migrated)
  }
  return migrated
}

export const useImageEditorStore = create<ImageEditorState>((set, get) => ({
  presets: loadInitialPresets(),
  groups: loadInitialGroups(),
  selectedGroupId: 'ungrouped',
  selectedPresetId: null,
  
  addPreset: (preset) => {
    const newPreset: ImagePreset = { 
      ...preset, 
      id: Date.now().toString(),
      groupId: preset.groupId || get().selectedGroupId || 'ungrouped'
    }
    const presets = [...get().presets, newPreset]
    set({ presets })
    safeStorage.set(PRESETS_STORAGE_KEY, presets)
  },

  loadPresets: () => {
    const storedPresets = safeStorage.get<ImagePreset[]>(PRESETS_STORAGE_KEY, [])
    const migratedPresets = storedPresets.map(p => ({
      ...p,
      groupId: p.groupId || 'ungrouped'
    }))
    set({ 
      presets: migratedPresets,
      groups: loadInitialGroups()
    })
    safeStorage.set(PRESETS_STORAGE_KEY, migratedPresets)
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
  
  addGroup: (group) => {
    const newGroup: PresetGroup = {
      ...group,
      id: Date.now().toString(),
      isBuiltIn: false
    }
    const groups = [...get().groups, newGroup]
    set({ groups })
    safeStorage.set(GROUPS_STORAGE_KEY, groups.filter(g => !g.isBuiltIn))
  },
  
  updateGroup: (id, updates) => {
    const group = get().groups.find(g => g.id === id)
    if (group?.isBuiltIn) return
    if (id === 'ungrouped') {
      const groups = get().groups.map(g => g.id === id ? { ...g, ...updates } : g)
      set({ groups })
      safeStorage.set(GROUPS_STORAGE_KEY, groups.filter(g => !g.isBuiltIn))
      return
    }
    const groups = get().groups.map(g => g.id === id ? { ...g, ...updates } : g)
    set({ groups })
    safeStorage.set(GROUPS_STORAGE_KEY, groups.filter(g => !g.isBuiltIn))
  },
  
  deleteGroup: (id) => {
    const group = get().groups.find(g => g.id === id)
    if (group?.isBuiltIn) return
    if (id === 'ungrouped') return
    
    const groups = get().groups.filter(g => g.id !== id)
    const presets = get().presets.map(p => p.groupId === id ? { ...p, groupId: 'ungrouped' } : p)
    set({ groups, presets, selectedGroupId: 'ungrouped' })
    safeStorage.set(GROUPS_STORAGE_KEY, groups.filter(g => !g.isBuiltIn))
    safeStorage.set(PRESETS_STORAGE_KEY, presets)
  },
  
  setSelectedGroup: (groupId) => {
    set({ selectedGroupId: groupId })
  },

  setSelectedPreset: (presetId) => {
    set({ selectedPresetId: presetId })
  }
}))
