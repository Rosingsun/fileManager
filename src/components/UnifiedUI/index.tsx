import React from 'react'
import { Button, Card, Tag } from 'antd'
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
