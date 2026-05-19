import React from 'react'
import { Radio, Checkbox, Typography } from 'antd'
import type { FileConflictAction } from '../../types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'

const { Paragraph } = Typography

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
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>复制到文件夹</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 0 }}>
            目标：{destDir}
          </Paragraph>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="qf-dialog-field">
        <span>重名时</span>
        <Radio.Group value={conflict} onChange={(e) => onConflictChange(e.target.value)}>
          <Radio value="rename">自动重命名</Radio>
          <Radio value="skip">跳过</Radio>
          <Radio value="overwrite">覆盖</Radio>
        </Radio.Group>
        <Checkbox checked={removeAfter} onChange={(e) => onRemoveAfterChange(e.target.checked)}>
          成功后从当前结果列表移除
        </Checkbox>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>取消</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>开始复制</AlertDialogAction>
      </AlertDialogFooter>
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
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <div className="qf-dialog-field">
        <span>重名时</span>
        <Radio.Group value={conflict} onChange={(e) => onConflictChange(e.target.value)}>
          <Radio value="rename">自动重命名</Radio>
          <Radio value="skip">跳过</Radio>
          <Radio value="overwrite">覆盖</Radio>
        </Radio.Group>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>取消</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
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
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>确认删除</AlertDialogTitle>
        <AlertDialogDescription>
          将永久删除选中的 {count} 个文件，此操作不可撤销。
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel} disabled={deleting}>
          取消
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          disabled={deleting}
          className="bg-destructive text-white hover:bg-destructive/90"
        >
          {deleting ? '删除中…' : '确定删除'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)
