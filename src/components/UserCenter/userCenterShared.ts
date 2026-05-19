import type { CSSProperties } from 'react'

export const userCenterCardStyle: CSSProperties = {
  background: 'var(--app-surface-elevated)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  borderRadius: 'var(--app-radius-lg)',
  border: '1px solid var(--app-border)',
  boxShadow: 'var(--app-shadow-xs)',
}

export type UserCenterTabKey =
  | 'overview'
  | 'stats'
  | 'preferences'
  | 'profile'
  | 'security'
  | 'oplog'
  | 'invites'
  | 'about'

export interface UserCenterNavItem {
  key: UserCenterTabKey
  label: string
  group: 'workspace' | 'account' | 'system'
}

export type UserCenterAppNavigate =
  | { type: 'tab'; tab: 'organize' | 'similarity' | 'classify' | 'tools' | 'quickFilter'; organizeMode?: 'local' | 'cloud' }
  | { type: 'organizePath'; path: string }

export interface UserCenterPanelProps {
  userId: string
  onNavigateApp: (target: UserCenterAppNavigate) => void
  onSwitchUserTab: (key: string) => void
}

export function desensitizeEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  if (local.length === 0) return `*@${domain}`
  const head = local.length <= 2 ? `${local[0]}***` : `${local.slice(0, 2)}***`
  return `${head}@${domain}`
}
