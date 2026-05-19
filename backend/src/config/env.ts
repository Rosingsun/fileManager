import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadDotEnv(): Record<string, string> {
  const envPath = resolve(__dirname, '../../.env')
  const out: Record<string, string> = { ...(process.env as Record<string, string>) }
  if (!existsSync(envPath)) return out
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

const raw = loadDotEnv()

/** mysql2 走 TCP；`localhost` 在部分环境下会先连 IPv6（::1）导致长时间挂起，统一为 IPv4 回环 */
function normalizeMysqlHost(host: string): string {
  const h = host.trim()
  return h.toLowerCase() === 'localhost' ? '127.0.0.1' : h
}

function resolveLogRoot(): string {
  const v = (raw.LOG_DIR || 'logs').trim()
  if (!v) {
    return resolve(process.cwd(), 'logs')
  }
  if (v.startsWith('/') || /^[A-Za-z]:[\\/]/.test(v)) {
    return resolve(v)
  }
  return resolve(process.cwd(), v)
}

export const env = {
  NODE_ENV: raw.NODE_ENV || 'development',
  PORT: Number(raw.PORT || 3847),
  JWT_SECRET: (raw.JWT_SECRET || '').trim(),

  /** 运行日志根目录；其下为 年/月/YYYY-MM-DD.log */
  LOG_ROOT: resolveLogRoot(),

  MYSQL_HOST: normalizeMysqlHost(raw.MYSQL_HOST || '127.0.0.1'),
  MYSQL_PORT: Number(raw.MYSQL_PORT || 3306),
  MYSQL_USER: raw.MYSQL_USER || 'root',
  MYSQL_PASSWORD: raw.MYSQL_PASSWORD ?? '',
  MYSQL_DATABASE: raw.MYSQL_DATABASE || 'filedeal',

  /** 为 true 时允许不传邀请码注册（仅建议开发环境） */
  ALLOW_OPEN_REGISTRATION: raw.ALLOW_OPEN_REGISTRATION === 'true',
  /** 长度≥16 时启用 POST /auth/bootstrap-first-user，仅在库中无任何用户时可创建首个账号 */
  BOOTSTRAP_INVITE_SECRET: (raw.BOOTSTRAP_INVITE_SECRET || 'rOSINGSUNaNDxULINJIE').trim(),
}

if (env.JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET 长度至少 16 字符，请在 backend/.env 中配置')
}
