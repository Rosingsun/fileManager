/**
 * 若不存在 backend/.env，则从 backend/.env.example 复制一份，便于首次联调。
 * 请根据本机 MySQL 修改 MYSQL_* 与 JWT_SECRET。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const target = path.join(root, 'backend', '.env')
const example = path.join(root, 'backend', '.env.example')

if (fs.existsSync(target)) {
  console.log('[init-backend-env] backend/.env 已存在，跳过')
  process.exit(0)
}

if (!fs.existsSync(example)) {
  console.error('[init-backend-env] 缺少 backend/.env.example')
  process.exit(1)
}

fs.copyFileSync(example, target)
console.log('[init-backend-env] 已创建 backend/.env，请编辑其中的 MYSQL_* 与 JWT_SECRET（至少 16 字符）')
