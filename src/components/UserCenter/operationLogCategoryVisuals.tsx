import type { ReactNode } from 'react'
import type { IconType } from '../icons'
import {
  TbChartBar,
  TbFolderOpen,
  TbPhotoSearch,
  TbCategory2,
  TbFilter,
  TbTools,
  TbUserCircle,
  TbDots,
} from '../icons'
import type { OperationLogCategory } from '../../utils'

const STAT_ICON_SIZE = 18

/** 与总览快捷入口色系一致 */
export const OPERATION_LOG_CATEGORY_ACCENTS: Record<OperationLogCategory, string> = {
  organize: '#0a84ff',
  similarity: '#7c5cff',
  classify: '#30b95a',
  quickFilter: '#ff9f0a',
  tools: '#5ac8fa',
  account: '#af52de',
  other: '#8e8e93',
}

const OPERATION_LOG_CATEGORY_ICON: Record<OperationLogCategory, IconType> = {
  organize: TbFolderOpen,
  similarity: TbPhotoSearch,
  classify: TbCategory2,
  quickFilter: TbFilter,
  tools: TbTools,
  account: TbUserCircle,
  other: TbDots,
}

export function operationLogCategoryIcon(category: OperationLogCategory): ReactNode {
  const Icon = OPERATION_LOG_CATEGORY_ICON[category]
  return <Icon size={STAT_ICON_SIZE} aria-hidden />
}

export function operationLogTotalIcon(): ReactNode {
  return <TbChartBar size={STAT_ICON_SIZE} aria-hidden />
}
