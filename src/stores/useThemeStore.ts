import { create } from 'zustand'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'app.theme'

export function readStoredPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

export function resolveThemeFromPreference(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

interface ThemeState {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  syncResolvedTheme: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: readStoredPreference(),
  resolvedTheme: resolveThemeFromPreference(readStoredPreference()),
  setPreference: (preference) => {
    try {
      localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      /* ignore */
    }
    set({ preference, resolvedTheme: resolveThemeFromPreference(preference) })
  },
  syncResolvedTheme: () => {
    set({ resolvedTheme: resolveThemeFromPreference(get().preference) })
  },
}))

export function subscribeSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange()
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
