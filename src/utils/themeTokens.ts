import type { ThemeConfig } from 'antd'
import type { ImageContentCategory } from '../types'

export const antAppTheme: ThemeConfig = {
  token: {
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
    borderRadius: 12,
    borderRadiusSM: 6,
    borderRadiusLG: 16,
    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.10)',
    boxShadowSecondary: '0 8px 24px rgba(15, 23, 42, 0.06)',
    controlHeight: 32,
    controlHeightSM: 28,
    controlHeightLG: 36,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', sans-serif",
  },
  components: {
    Layout: {
      bodyBg: '#f5f7fb',
      headerBg: 'transparent',
    },
    Card: {
      borderRadiusLG: 16,
      boxShadowTertiary: '0 8px 24px rgba(15, 23, 42, 0.06)',
      headerBg: 'transparent',
    },
    Button: {
      borderRadius: 8,
      primaryShadow: 'none',
    },
    Table: {
      headerBg: 'rgba(246, 248, 252, 0.94)',
      borderColor: 'rgba(15, 23, 42, 0.08)',
    },
    Modal: {
      borderRadiusLG: 16,
    },
    Select: {
      optionSelectedBg: 'rgba(10, 132, 255, 0.12)',
    },
  },
}

const categoryColorMap: Record<ImageContentCategory, string> = {
  person: '#7c5cff',
  portrait: '#c45cff',
  selfie: '#ff7b6b',
  dog: '#ff9f0a',
  cat: '#ffd60a',
  bird: '#2cc5c9',
  wild_animal: '#30b95a',
  marine_animal: '#3c91ff',
  insect: '#84cc16',
  pet: '#ffc857',
  landscape: '#5fbf65',
  mountain: '#2a9d8f',
  beach: '#54b5ff',
  sunset: '#ff8a3d',
  forest: '#2f8f46',
  cityscape: '#3c62d8',
  night_scene: '#6d5dfc',
  building: '#4b8bff',
  landmark: '#20c7b3',
  interior: '#64c16a',
  street: '#5672e8',
  food: '#ff5f57',
  drink: '#6bbdff',
  dessert: '#ff8fc7',
  vehicle: '#4d8eff',
  aircraft: '#7a88ff',
  ship: '#37cdd0',
  art: '#ef5da8',
  technology: '#495ce8',
  document: '#ffb340',
  other: '#8b95a7',
}

export function getCategoryTagColor(category: ImageContentCategory): string {
  return categoryColorMap[category] || categoryColorMap.other
}
