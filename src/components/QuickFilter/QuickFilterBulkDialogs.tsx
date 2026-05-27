import React from 'react'
import type { FileConflictAction } from '../../types'
import { TbCopy, TbFolderSymlink, TbTrash } from '../icons'
import { Checkbox } from '../ui/checkbox'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { FeatureActionButton } from '../FeatureAction'
import { FeatureActionDialogFooter } from '../FeatureAction'

const CONFLICT_OPTIONS: { value: FileConflictAction; label: string }[] = [
  { value: 'rename', label: '自动重命名' },
  { value: 'skip', label: '跳过' },
  { value: 'overwrite', label: '覆盖' },
]

function ConflictOptionGroup({
  value,
  onChange,
}: {
  value: FileConflictAction
  onChange: (v: FileConflictAction) => void
}) {
  return (
    <div className="qf-dialog-segment" role="radiogroup" aria-label="重名时">
      {CONFLICT_OPTIONS.map((opt) => (
        <FeatureActionButton
          key={opt.value}
          type="button"
          variant="segment"
          size="sm"
          active={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </FeatureActionButton>
      ))}
    </div>
  )
}

function DialogField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="qf-dialog-field">
      <span className="qf-dialog-field__label">{label}</span>
      {children}
    </div>
  )
}

interface CopyDialogProps {
  open: boolean
  destDir: string
  conflict: FileConflictAction
  removeAfter: boolean
  onConflictChange: (v: FileConflictAction) => void
  onRemoveAfterChange: (v: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}

export const QuickFilterCopyDialog: React.FC<CopyDialogProps> = ({
  open,
  destDir,
  conflict,
  removeAfter,
  onConflictChange,
  onRemoveAfterChange,
  onCancel,
  onConfirm,
}) => (
  <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
    <AlertDialogContent className="qf-dialog-content">
      <AlertDialogHeader>
        <AlertDialogMedia className="qf-dialog-media qf-dialog-media--primary">
          <TbCopy aria-hidden />
        </AlertDialogMedia>
        <AlertDialogTitle>复制到文件夹</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <p className="qf-dialog-desc">
            将把选中文件复制到下方目标目录，原文件保留不变。
          </p>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="qf-dialog-path" title={destDir}>
        <span className="qf-dialog-path__label">目标目录</span>
        <code className="qf-dialog-path__value">{destDir}</code>
      </div>
      <DialogField label="重名时">
        <ConflictOptionGroup value={conflict} onChange={onConflictChange} />
      </DialogField>
      <label className="qf-dialog-check">
        <Checkbox checked={removeAfter} onCheckedChange={(v) => onRemoveAfterChange(v === true)} />
        <span>复制成功后从当前结果列表移除</span>
      </label>
      <FeatureActionDialogFooter
        confirmLabel="开始复制"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </AlertDialogContent>
  </AlertDialog>
)

interface OrganizeDialogProps {
  open: boolean
  title: string
  description: string
  conflict: FileConflictAction
  confirmLabel: string
  onConflictChange: (v: FileConflictAction) => void
  onCancel: () => void
  onConfirm: () => void
}

export const QuickFilterOrganizeDialog: React.FC<OrganizeDialogProps> = ({
  open,
  title,
  description,
  conflict,
  confirmLabel,
  onConflictChange,
  onCancel,
  onConfirm,
}) => (
  <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
    <AlertDialogContent className="qf-dialog-content">
      <AlertDialogHeader>
        <AlertDialogMedia className="qf-dialog-media qf-dialog-media--warning">
          <TbFolderSymlink aria-hidden />
        </AlertDialogMedia>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <p className="qf-dialog-desc">{description}</p>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <DialogField label="重名时">
        <ConflictOptionGroup value={conflict} onChange={onConflictChange} />
      </DialogField>
      <FeatureActionDialogFooter
        confirmLabel={confirmLabel}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </AlertDialogContent>
  </AlertDialog>
)

interface DeleteDialogProps {
  open: boolean
  count: number
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export const QuickFilterDeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  count,
  deleting,
  onCancel,
  onConfirm,
}) => (
  <AlertDialog open={open} onOpenChange={(v) => !v && !deleting && onCancel()}>
    <AlertDialogContent className="qf-dialog-content qf-dialog-content--danger">
      <AlertDialogHeader>
        <AlertDialogMedia className="qf-dialog-media qf-dialog-media--danger">
          <TbTrash aria-hidden />
        </AlertDialogMedia>
        <AlertDialogTitle>确认删除</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <p className="qf-dialog-desc">
            将永久删除选中的 <strong className="qf-dialog-count">{count}</strong> 个文件，此操作不可撤销。
          </p>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <FeatureActionDialogFooter
        confirmLabel={deleting ? '删除中…' : '确定删除'}
        confirmVariant="danger"
        cancelDisabled={deleting}
        confirmDisabled={deleting}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </AlertDialogContent>
  </AlertDialog>
)
