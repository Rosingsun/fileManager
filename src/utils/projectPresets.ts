import type { ImagePreset } from '../types'

const PROJECT_PRESETS_KEY = 'filedeal_project_preset_pack'

export interface ProjectPresetPack {
  name: string
  presets: ImagePreset[]
  exportedAt: number
}

export function exportProjectPresetPack(presets: ImagePreset[], name = '工作室预设包'): void {
  const pack: ProjectPresetPack = { name, presets, exportedAt: Date.now() }
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/[/\\:*?"<>|]/g, '_')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importProjectPresetPack(file: File): Promise<ProjectPresetPack> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as ProjectPresetPack
        if (!Array.isArray(data.presets)) throw new Error('invalid pack')
        resolve(data)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function loadStoredProjectPresetPack(): ProjectPresetPack | null {
  try {
    const raw = localStorage.getItem(PROJECT_PRESETS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ProjectPresetPack
  } catch {
    return null
  }
}

export function saveStoredProjectPresetPack(pack: ProjectPresetPack): void {
  localStorage.setItem(PROJECT_PRESETS_KEY, JSON.stringify(pack))
}
