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

/** 内置预设选中态 ID（非 localStorage 中的用户预设） */
export function isBuiltinPresetSelectionId(id: string): boolean {
  return id.startsWith('builtin-')
}

const RESERVED_BUILTIN_GROUP_IDS = new Set<string>(BUILTIN_PRESET_COLLECTION_IDS)
const UNGROUPED_GROUP_ID = 'ungrouped'

/** 仅持久化用户自建分组，避免与内置「未分组」重复写入 localStorage */
function persistUserGroups(groups: PresetGroup[]): void {
  safeStorage.set(
    GROUPS_STORAGE_KEY,
    groups.filter(g => !g.isBuiltIn && g.id !== UNGROUPED_GROUP_ID)
  )
}

/** 将预设归到可展示的用户分组，避免挂在内置品牌/系统分组下导致列表不可见 */
function resolvePresetGroupId(
  explicitGroupId: string | undefined,
  fallbackGroupId: string,
  groups: PresetGroup[]
): string {
  let candidate = (explicitGroupId || '').trim()
  if (!candidate || isBuiltinPresetCollectionGroup(candidate)) {
    candidate = isBuiltinPresetCollectionGroup(fallbackGroupId)
      ? UNGROUPED_GROUP_ID
      : fallbackGroupId
  }
  if (isBuiltinPresetCollectionGroup(candidate)) return UNGROUPED_GROUP_ID
  if (!groups.some(g => g.id === candidate)) return UNGROUPED_GROUP_ID
  return candidate
}

function normalizePreset(p: ImagePreset, groups: PresetGroup[]): ImagePreset {
  return {
    ...p,
    groupId: resolvePresetGroupId(p.groupId, UNGROUPED_GROUP_ID, groups)
  }
}

const loadInitialGroups = (): PresetGroup[] => {
  const stored = safeStorage.get<PresetGroup[]>(GROUPS_STORAGE_KEY, [])
  const userGroups = stored.filter(
    g => !RESERVED_BUILTIN_GROUP_IDS.has(g.id) && g.id !== UNGROUPED_GROUP_ID
  )

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

const loadInitialPresets = (groups: PresetGroup[]): ImagePreset[] => {
  const stored = safeStorage.get<ImagePreset[]>(PRESETS_STORAGE_KEY, [])
  const migrated = stored.map(p => normalizePreset(p, groups))
  if (JSON.stringify(stored) !== JSON.stringify(migrated)) {
    safeStorage.set(PRESETS_STORAGE_KEY, migrated)
  }
  return migrated
}

const initialGroups = loadInitialGroups()

export const useImageEditorStore = create<ImageEditorState>((set, get) => ({
  presets: loadInitialPresets(initialGroups),
  groups: initialGroups,
  selectedGroupId: 'system',
  selectedPresetId: null,
  
  addPreset: (preset) => {
    const groups = get().groups
    const newPreset: ImagePreset = {
      ...preset,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      groupId: resolvePresetGroupId(preset.groupId, get().selectedGroupId, groups)
    }
    const presets = [...get().presets, newPreset]
    set({ presets, selectedPresetId: newPreset.id })
    safeStorage.set(PRESETS_STORAGE_KEY, presets)
  },

  loadPresets: () => {
    const groups = loadInitialGroups()
    const storedPresets = safeStorage.get<ImagePreset[]>(PRESETS_STORAGE_KEY, [])
    const migratedPresets = storedPresets.map(p => normalizePreset(p, groups))
    const selectedPresetId = get().selectedPresetId
    const selectionStillValid =
      selectedPresetId != null &&
      !isBuiltinPresetSelectionId(selectedPresetId) &&
      migratedPresets.some(p => p.id === selectedPresetId)
    set({
      presets: migratedPresets,
      groups,
      selectedPresetId: selectionStillValid ? selectedPresetId : null
    })
    safeStorage.set(PRESETS_STORAGE_KEY, migratedPresets)
  },
  
  updatePreset: (id, updates) => {
    if (isBuiltinPresetSelectionId(id)) return
    if (!get().presets.some(p => p.id === id)) return
    const presets = get().presets.map(p => (p.id === id ? { ...p, ...updates } : p))
    set({ presets })
    safeStorage.set(PRESETS_STORAGE_KEY, presets)
  },
  
  deletePreset: (id) => {
    if (isBuiltinPresetSelectionId(id)) return
    const presets = get().presets.filter(p => p.id !== id)
    const selectedPresetId = get().selectedPresetId === id ? null : get().selectedPresetId
    set({ presets, selectedPresetId })
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
    persistUserGroups(groups)
  },
  
  updateGroup: (id, updates) => {
    const group = get().groups.find(g => g.id === id)
    if (group?.isBuiltIn) return
    if (id === UNGROUPED_GROUP_ID) {
      const groups = get().groups.map(g => (g.id === id ? { ...g, ...updates } : g))
      set({ groups })
      persistUserGroups(groups)
      return
    }
    const groups = get().groups.map(g => (g.id === id ? { ...g, ...updates } : g))
    set({ groups })
    persistUserGroups(groups)
  },
  
  deleteGroup: (id) => {
    const group = get().groups.find(g => g.id === id)
    if (group?.isBuiltIn) return
    if (id === UNGROUPED_GROUP_ID) return
    
    const groups = get().groups.filter(g => g.id !== id)
    const presets = get().presets.map(p =>
      p.groupId === id ? { ...p, groupId: UNGROUPED_GROUP_ID } : p
    )
    const selectedPresetId =
      get().selectedPresetId && get().presets.find(p => p.id === get().selectedPresetId)?.groupId === id
        ? null
        : get().selectedPresetId
    set({ groups, presets, selectedGroupId: UNGROUPED_GROUP_ID, selectedPresetId })
    persistUserGroups(groups)
    safeStorage.set(PRESETS_STORAGE_KEY, presets)
  },
  
  setSelectedGroup: (groupId) => {
    set({ selectedGroupId: groupId, selectedPresetId: null })
  },

  setSelectedPreset: (presetId) => {
    set({ selectedPresetId: presetId })
  }
}))
