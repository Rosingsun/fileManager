import { create } from 'zustand'
import type { ImagePreset, PresetGroup } from '../types'

const PRESETS_STORAGE_KEY = 'filedeal_image_editor_presets'
const GROUPS_STORAGE_KEY = 'filedeal_image_editor_groups'

const BUILTIN_SYSTEM_GROUP: PresetGroup = {
  id: 'system',
  name: '系统预设',
  isBuiltIn: true
}

const BUILTIN_FUJI_GROUP: PresetGroup = {
  id: 'fuji',
  name: '富士',
  isBuiltIn: true
}

const BUILTIN_CANON_GROUP: PresetGroup = {
  id: 'canon',
  name: '佳能',
  isBuiltIn: true
}

const BUILTIN_NIKON_GROUP: PresetGroup = {
  id: 'nikon',
  name: '尼康',
  isBuiltIn: true
}

const BUILTIN_SONY_GROUP: PresetGroup = {
  id: 'sony',
  name: '索尼',
  isBuiltIn: true
}

const BUILTIN_KODAK_GROUP: PresetGroup = {
  id: 'kodak',
  name: '柯达',
  isBuiltIn: true
}

const BUILTIN_LEICA_GROUP: PresetGroup = {
  id: 'leica',
  name: '徕卡',
  isBuiltIn: true
}

const BUILTIN_POLAROID_GROUP: PresetGroup = {
  id: 'polaroid',
  name: '宝丽来',
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

/** 内置「系统 + 各品牌」分组 ID，用于面板展示内置预设；持久化恢复时需过滤避免与用户分组冲突 */
export const BUILTIN_PRESET_COLLECTION_IDS = [
  'system',
  'fuji',
  'canon',
  'nikon',
  'sony',
  'kodak',
  'leica',
  'polaroid',
] as const

export function isBuiltinPresetCollectionGroup(id: string): boolean {
  return (BUILTIN_PRESET_COLLECTION_IDS as readonly string[]).includes(id)
}

const RESERVED_BUILTIN_GROUP_IDS = new Set<string>(BUILTIN_PRESET_COLLECTION_IDS)

const loadInitialGroups = (): PresetGroup[] => {
  const stored = safeStorage.get<PresetGroup[]>(GROUPS_STORAGE_KEY, [])
  const userGroups = stored.filter(g => !RESERVED_BUILTIN_GROUP_IDS.has(g.id))

  return [
    BUILTIN_SYSTEM_GROUP,
    BUILTIN_FUJI_GROUP,
    BUILTIN_CANON_GROUP,
    BUILTIN_NIKON_GROUP,
    BUILTIN_SONY_GROUP,
    BUILTIN_KODAK_GROUP,
    BUILTIN_LEICA_GROUP,
    BUILTIN_POLAROID_GROUP,
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
