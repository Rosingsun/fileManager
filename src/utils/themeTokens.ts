import { theme, type ThemeConfig } from 'antd'
import type { ImageContentCategory } from '../types'

export type AppThemeMode = 'light' | 'dark'

const lightTokens = {
  colorPrimary: '#0a84ff',
  colorSuccess: '#30b95a',
  colorWarning: '#ff9f0a',
  colorError: '#ff453a',
  colorInfo: '#5ac8fa',
  colorText: '#1f2329',
  colorTextSecondary: '#5d6673',
  colorTextTertiary: '#8a94a6',
  colorBgBase: '#ffffff',
  colorBgLayout: '#f5f7fb',
  colorBorder: 'rgba(15, 23, 42, 0.08)',
  colorBorderSecondary: 'rgba(15, 23, 42, 0.05)',
  colorFillAlter: '#f6f8fc',
  colorPrimaryBg: 'rgba(10, 132, 255, 0.12)',
  colorPrimaryBgHover: 'rgba(10, 132, 255, 0.18)',
  colorPrimaryBorder: 'rgba(10, 132, 255, 0.24)',
}

const darkTokens = {
  colorPrimary: '#409cff',
  colorSuccess: '#3ddc6c',
  colorWarning: '#ffb340',
  colorError: '#ff6961',
  colorInfo: '#70d7ff',
  colorText: '#f2f4f8',
  colorTextSecondary: '#a8b0bd',
  colorTextTertiary: '#7a8494',
  colorBgBase: '#1c212b',
  colorBgLayout: '#0f1117',
  colorBorder: 'rgba(255, 255, 255, 0.1)',
  colorBorderSecondary: 'rgba(255, 255, 255, 0.06)',
  colorFillAlter: '#232936',
  colorPrimaryBg: 'rgba(64, 156, 255, 0.18)',
  colorPrimaryBgHover: 'rgba(64, 156, 255, 0.26)',
  colorPrimaryBorder: 'rgba(64, 156, 255, 0.42)',
}

const sharedComponentTokens = {
  Card: {
    borderRadiusLG: 16,
    boxShadowTertiary: 'var(--app-shadow-sm)',
    headerBg: 'transparent',
  },
  Button: {
    borderRadius: 8,
    primaryShadow: 'none',
  },
  Table: {
    headerBg: 'var(--app-surface-subtle)',
    borderColor: 'var(--app-border)',
  },
  Modal: {
    borderRadiusLG: 16,
  },
  Select: {
    optionSelectedBg: 'var(--app-selected-bg)',
  },
  Layout: {
    headerBg: 'transparent',
  },
}

export function getAntAppTheme(mode: AppThemeMode = 'light'): ThemeConfig {
  const token = mode === 'dark' ? darkTokens : lightTokens
  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      ...token,
      borderRadius: 12,
      borderRadiusSM: 6,
      borderRadiusLG: 16,
      boxShadow: 'var(--app-shadow-md)',
      boxShadowSecondary: 'var(--app-shadow-sm)',
      controlHeight: 32,
      controlHeightSM: 28,
      controlHeightLG: 36,
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', sans-serif",
    },
    components: {
      ...sharedComponentTokens,
      Layout: {
        ...sharedComponentTokens.Layout,
        bodyBg: mode === 'dark' ? darkTokens.colorBgLayout : lightTokens.colorBgLayout,
      },
    },
  }
}

/** @deprecated 使用 getAntAppTheme(resolvedTheme) */
export const antAppTheme = getAntAppTheme('light')

export const FILE_TYPE_ICON_COLORS = {
  folder: 'var(--app-file-folder)',
  pdf: 'var(--app-file-pdf)',
  word: 'var(--app-file-word)',
  excel: 'var(--app-file-excel)',
  video: 'var(--app-file-video)',
  audio: 'var(--app-file-audio)',
  archive: 'var(--app-file-archive)',
  default: 'var(--app-file-default)',
} as const

const categoryColorMap: Record<ImageContentCategory, string> = {
  person: '#7c5cff',
  animal: '#30b95a',
  landscape: '#5fbf65',
  urban: '#3c62d8',
  indoor: '#64c16a',
  food: '#ff5f57',
  vehicle: '#4d8eff',
  document: '#ffb340',
  other: '#8b95a7',
}

export function getCategoryTagColor(category: ImageContentCategory): string {
  return categoryColorMap[category] || categoryColorMap.other
}
