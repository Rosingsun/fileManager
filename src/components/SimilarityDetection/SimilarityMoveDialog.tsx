import React from 'react'
import type { FileConflictAction } from '../../types'
import { TbFolderSymlink } from '../icons'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { FeatureActionButton, FeatureActionDialogFooter } from '../FeatureAction'
import { SimilarityButton } from './SimilarityButton'

const CONFLICT_OPTIONS: { value: FileConflictAction; label: string }[] = [
  { value: 'rename', label: '自动重命名' },
  { value: 'skip', label: '跳过' },
  { value: 'overwrite', label: '覆盖' },
]

interface SimilarityMoveDialogProps {
  open: boolean
  destDir: string
  fileCount: number
  keepCount: number
  conflict: FileConflictAction
  moving: boolean
  onConflictChange: (value: FileConflictAction) => void
  onPickFolder: () => void
  onCancel: () => void
  onConfirm: () => void
}

const SimilarityMoveDialog: React.FC<SimilarityMoveDialogProps> = ({
  open,
  destDir,
  fileCount,
  keepCount,
  conflict,
  moving,
  onConflictChange,
  onPickFolder,
  onCancel,
  onConfirm,
}) => (
  <AlertDialog
    open={open}
    onOpenChange={(v) => {
      if (!v && !moving) onCancel()
    }}
  >
    <AlertDialogContent className="sim-dialog-content">
      <AlertDialogHeader>
        <AlertDialogMedia className="sim-dialog-media">
          <TbFolderSymlink aria-hidden />
        </AlertDialogMedia>
        <AlertDialogTitle>移入重复文件夹</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <p className="sim-dialog-desc">
            将把 <strong>{fileCount}</strong> 张冗余照片移动到重复文件夹；
            <strong>{keepCount}</strong> 张保留照片继续留在原位置。
          </p>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="sim-dialog-path" title={destDir}>
        <span className="sim-dialog-path__label">重复文件夹</span>
        <code className="sim-dialog-path__value">{destDir}</code>
      </div>
      <SimilarityButton
        variant="secondary"
        size="sm"
        disabled={moving}
        onClick={onPickFolder}
      >
        选择其他文件夹
      </SimilarityButton>
      <div className="sim-dialog-field">
        <span className="sim-dialog-field__label">重名时</span>
        <div className="sim-dialog-segment" role="radiogroup" aria-label="重名时">
          {CONFLICT_OPTIONS.map((opt) => (
            <FeatureActionButton
              key={opt.value}
              type="button"
              variant="segment"
              size="sm"
              active={conflict === opt.value}
              disabled={moving}
              onClick={() => onConflictChange(opt.value)}
            >
              {opt.label}
            </FeatureActionButton>
          ))}
        </div>
      </div>
      <FeatureActionDialogFooter
        confirmLabel={moving ? '移动中…' : '开始整理'}
        cancelDisabled={moving}
        confirmDisabled={moving}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </AlertDialogContent>
  </AlertDialog>
)

export default SimilarityMoveDialog
