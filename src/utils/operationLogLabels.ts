export const OPERATION_LOG_ACTION_LABELS: Record<string, string> = {
  login: '登录',
  register: '注册',
  bootstrap_first_user: '引导创建首个账号',
  session_restored: '恢复会话',
  logout: '退出登录',
  password_changed: '修改密码',
  app_closed: '关闭应用',
  profile_updated: '更新个人资料',
  invite_code_created: '生成邀请码',
  directory_selected: '选择工作目录',
  file_organize: '文件整理（执行）',
  file_organize_preview: '文件整理（预览）',
  file_extract: '文件提取',
  file_rename: '文件重命名',
  file_delete: '删除文件',
  file_batch_delete: '批量删除',
  file_batch_rename: '批量重命名',
  file_batch_move: '批量移动',
  file_batch_copy: '批量复制到目录',
  file_batch_relocate: '批量移动/整理',
  similarity_scan: '相似照片扫描',
  similarity_mark_keep: '相似图标记保留',
  similarity_batch_delete: '相似图批量删除',
  image_classify_batch: '图片分类（批量）',
  image_classify_file_list: '图片分类（文件列表）',
  image_classify_clear: '清除分类结果',
  classification_dir_selected: '图片分类选择目录',
  classification_model_download: '分类模型下载',
  classification_model_saved: '分类模型保存',
  image_quality_scan: '图片质量扫描',
  quick_filter_tier_write: '快速筛选写入评级',
  quick_filter_export_csv: '快速筛选导出 CSV',
  quick_filter_bulk_delete: '快速筛选批量删除',
  image_stitch: '图片拼接',
  thumbnail_generate: '缩略图生成',
  batch_rename_tool: '批量重命名（工具）',
  watermark_tool: '添加水印',
  gif_create: 'GIF 制作',
  format_convert: '图片格式转换',
  pdf_from_images: '图片转 PDF',
  image_enhance: '图片增强',
  image_editor_apply: '图片编辑应用',
  image_editor_batch_apply: '图片批量编辑',
  image_compress: '图片压缩',
  image_format_convert_editor: '图片格式转换（编辑器）',
  editor_preset_update: '编辑预设更新',
  editor_preset_save: '编辑预设保存',
  editor_preset_delete: '编辑预设删除',
  editor_group_add: '编辑预设分组添加',
  editor_group_update: '编辑预设分组更新',
  editor_group_delete: '编辑预设分组删除',
  size_range_reset: '大小分类范围重置',
  size_range_delete: '大小分类范围删除',
  size_range_update: '大小分类范围更新',
  size_range_add: '大小分类范围添加',
}

export type OperationLogCategory =
  | 'organize'
  | 'similarity'
  | 'classify'
  | 'quickFilter'
  | 'tools'
  | 'account'
  | 'other'

export const OPERATION_LOG_CATEGORY_LABELS: Record<OperationLogCategory, string> = {
  organize: '整理与文件',
  similarity: '相似照片',
  classify: '智能分类',
  quickFilter: '快速筛选',
  tools: '图片编辑与工具',
  account: '账号与邀请',
  other: '其他',
}

export function operationLogActionLabel(action: string): string {
  return OPERATION_LOG_ACTION_LABELS[action] ?? action
}

export function operationLogCategoryOfAction(action: string): OperationLogCategory {
  if (
    action.startsWith('file_') ||
    action === 'directory_selected' ||
    action.startsWith('size_range_')
  ) {
    return 'organize'
  }
  if (action.startsWith('similarity_')) return 'similarity'
  if (action.startsWith('image_classify_') || action.startsWith('classification_')) return 'classify'
  if (action.startsWith('quick_filter_') || action === 'image_quality_scan') return 'quickFilter'
  if (
    action.startsWith('image_') ||
    action.startsWith('editor_') ||
    action === 'thumbnail_generate' ||
    action === 'batch_rename_tool' ||
    action === 'watermark_tool' ||
    action === 'gif_create' ||
    action === 'format_convert' ||
    action === 'pdf_from_images'
  ) {
    return 'tools'
  }
  if (
    action === 'login' ||
    action === 'register' ||
    action === 'logout' ||
    action === 'session_restored' ||
    action === 'password_changed' ||
    action === 'profile_updated' ||
    action === 'invite_code_created' ||
    action === 'bootstrap_first_user' ||
    action === 'app_closed'
  ) {
    return 'account'
  }
  return 'other'
}
