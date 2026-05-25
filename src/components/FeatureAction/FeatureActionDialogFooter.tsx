import React from 'react'
import {
  FeatureActionButton,
  type FeatureActionButtonVariant,
} from './FeatureActionButton'

interface FeatureActionDialogFooterProps {
  cancelLabel?: string
  confirmLabel: string
  confirmVariant?: FeatureActionButtonVariant
  cancelDisabled?: boolean
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export const FeatureActionDialogFooter: React.FC<FeatureActionDialogFooterProps> = ({
  cancelLabel = '取消',
  confirmLabel,
  confirmVariant = 'primary',
  cancelDisabled = false,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}) => (
  <div className="feat-dialog-footer">
    <FeatureActionButton variant="ghost" size="md" disabled={cancelDisabled} onClick={onCancel}>
      {cancelLabel}
    </FeatureActionButton>
    <FeatureActionButton
      variant={confirmVariant}
      size="md"
      disabled={confirmDisabled}
      onClick={onConfirm}
    >
      {confirmLabel}
    </FeatureActionButton>
  </div>
)
