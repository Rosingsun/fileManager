import React from 'react'
import { Button, Card, Tag } from 'antd'
import type { CardProps } from 'antd'
import classNames from 'classnames'
import './unified-ui.css'

interface PageSectionProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  extra?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export const PageSection: React.FC<PageSectionProps> = ({ title, subtitle, extra, children, className }) => (
  <Card className={classNames('unified-page-section', className)} bordered={false}>
    <div className="unified-page-section__header">
      <div>
        <div className="unified-page-section__title">{title}</div>
        {subtitle ? <div className="unified-page-section__subtitle">{subtitle}</div> : null}
      </div>
      {extra ? <div className="unified-page-section__extra">{extra}</div> : null}
    </div>
    <div className="unified-page-section__body">{children}</div>
  </Card>
)

interface GlassCardProps extends CardProps {
  fillHeight?: boolean
}

export const GlassCard: React.FC<GlassCardProps> = ({ className, fillHeight, bordered = false, ...rest }) => (
  <Card
    className={classNames('app-surface-card', fillHeight && 'app-surface-card--fill', className)}
    bordered={bordered}
    {...rest}
  />
)

interface PageHeaderProps {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  extra?: React.ReactNode
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({ icon, title, subtitle, extra, className }) => (
  <div className={classNames('unified-page-header', className)}>
    <div className="unified-page-header__main">
      <span className="unified-page-header__icon">{icon}</span>
      <div>
        <div className="unified-page-header__title">{title}</div>
        {subtitle ? <div className="unified-page-header__subtitle">{subtitle}</div> : null}
      </div>
    </div>
    {extra ? <div className="unified-page-header__extra">{extra}</div> : null}
  </div>
)

interface ToolTileProps {
  label: string
  icon: React.ReactNode
  accent?: string
  onClick?: () => void
  className?: string
}

export const ToolTile: React.FC<ToolTileProps> = ({ label, icon, accent, onClick, className }) => (
  <button
    type="button"
    className={classNames('user-center-shortcut-tile', className)}
    style={{ ['--shortcut-accent' as string]: accent || 'var(--app-primary)' }}
    onClick={onClick}
  >
    <span className="user-center-shortcut-tile__icon">{icon}</span>
    <span className="user-center-shortcut-tile__label">{label}</span>
  </button>
)

interface SettingsRowProps {
  title: React.ReactNode
  hint?: React.ReactNode
  children: React.ReactNode
}

export const SettingsRow: React.FC<SettingsRowProps> = ({ title, hint, children }) => (
  <div className="user-center-settings-row">
    <div className="user-center-settings-row__main">
      <div className="unified-settings-row__title">{title}</div>
      {hint ? <div className="user-center-settings-row__hint">{hint}</div> : null}
    </div>
    {children}
  </div>
)

interface AppEmptyStateProps {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  panel?: boolean
  className?: string
}

export const AppEmptyState: React.FC<AppEmptyStateProps> = ({
  icon,
  title,
  description,
  actions,
  panel = false,
  className,
}) => (
  <div className={classNames('app-empty-state', panel && 'is-panel', className)}>
    {icon ? <div className="app-empty-state__icon">{icon}</div> : null}
    <div className="app-empty-state__title">{title}</div>
    {description ? <div className="app-empty-state__description">{description}</div> : null}
    {actions}
  </div>
)

interface StatCardProps {
  title: string
  value: React.ReactNode
  icon?: React.ReactNode
  accent?: string
  subtle?: boolean
  onClick?: () => void
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, accent, subtle = false, onClick }) => (
  <button
    type="button"
    className={classNames('unified-stat-card', { 'is-clickable': !!onClick, 'is-subtle': subtle })}
    style={{ ['--stat-accent' as string]: accent || 'var(--app-primary)' }}
    onClick={onClick}
  >
    <span className="unified-stat-card__icon">{icon}</span>
    <span className="unified-stat-card__title">{title}</span>
    <span className="unified-stat-card__value">{value}</span>
  </button>
)

interface CategoryTagProps {
  label: React.ReactNode
  color: string
}

export const CategoryTag: React.FC<CategoryTagProps> = ({ label, color }) => (
  <Tag
    className="unified-category-tag"
    style={{
      color,
      backgroundColor: `${color}1A`,
      borderColor: `${color}33`,
    }}
  >
    {label}
  </Tag>
)

interface SelectionActionBarProps {
  summary: React.ReactNode
  children: React.ReactNode
  onClear: () => void
}

export const SelectionActionBar: React.FC<SelectionActionBarProps> = ({ summary, children, onClear }) => (
  <div className="unified-selection-bar">
    <div className="unified-selection-bar__summary">{summary}</div>
    <div className="unified-selection-bar__actions">{children}</div>
    <Button size="small" onClick={onClear}>
      取消选择
    </Button>
  </div>
)
