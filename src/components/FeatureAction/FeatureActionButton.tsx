import React from 'react'
import { cn } from '@/lib/utils'

export type FeatureActionButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'emphasis'
  | 'danger'
  | 'segment'

export type FeatureActionButtonSize = 'sm' | 'md' | 'lg'

export interface FeatureActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: FeatureActionButtonVariant
  size?: FeatureActionButtonSize
  icon?: React.ReactNode
  active?: boolean
  fullWidth?: boolean
}

export const FeatureActionButton = React.forwardRef<HTMLButtonElement, FeatureActionButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      icon,
      active = false,
      fullWidth = false,
      className,
      children,
      type = 'button',
      disabled,
      ...rest
    },
    ref
  ) => {
    const onlyIcon = Boolean(icon) && !children

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'feat-btn',
          `feat-btn--${variant}`,
          `feat-btn--${size}`,
          onlyIcon && 'feat-btn--icon-only',
          active && 'is-active',
          fullWidth && 'feat-btn--full',
          className
        )}
        {...rest}
      >
        {icon ? <span className="feat-btn__icon" aria-hidden>{icon}</span> : null}
        {children ? <span className="feat-btn__label">{children}</span> : null}
      </button>
    )
  }
)

FeatureActionButton.displayName = 'FeatureActionButton'

export function FeatureActionButtonGroup({
  className,
  children,
  'aria-label': ariaLabel,
}: {
  className?: string
  children: React.ReactNode
  'aria-label'?: string
}) {
  return (
    <div className={cn('feat-btn-group', className)} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  )
}
