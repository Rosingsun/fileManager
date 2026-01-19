import type { OrganizeConfig, FileInfo, SizeRange } from '../types'

/**
 * 生成整理预览结果
 */
export async function generatePreview(
  files: FileInfo[],
  config: OrganizeConfig,
  sizeRanges?: SizeRange[]
): Promise<Array<{ from: string; to: string }>> {
  const results: Array<{ from: string; to: string }> = []
  const { sourcePath, rules } = config

  for (const file of files) {
    if (file.isDirectory) continue

    let targetDir = sourcePath

    if (rules.type === 'extension') {
      // 按扩展名分类
      const ext = file.name.split('.').pop()?.toLowerCase() || 'other'
      targetDir = `${sourcePath}/${ext}`
    } else if (rules.type === 'date') {
      // 按修改日期分类
      const date = new Date(file.modifiedTime)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')

      if (rules.dateFormat === 'year') {
        targetDir = `${sourcePath}/${year}`
      } else if (rules.dateFormat === 'month') {
        targetDir = `${sourcePath}/${year}/${month}`
      } else {
        targetDir = `${sourcePath}/${year}/${month}/${day}`
      }
    } else if (rules.type === 'size') {
      // 按文件大小分类（使用自定义范围）
      const ranges = sizeRanges || []
      const range = ranges.find(r => file.size >= r.minSize && file.size < r.maxSize)
      const categoryName = range ? range.name : '其他'
      targetDir = `${sourcePath}/${categoryName}`
    } else if (rules.type === 'custom' && rules.pattern) {
      // 自定义规则（正则表达式）
      const match = file.name.match(new RegExp(rules.pattern))
      if (match && match[1]) {
        targetDir = `${sourcePath}/${match[1]}`
      }
    }

    results.push({
      from: file.path,
      to: `${targetDir}/${file.name}`
    })
  }

  return results
}

