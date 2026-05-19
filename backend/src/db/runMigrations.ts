import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function runMigrations(pool: Pool): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at BIGINT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    const migrationsDir = join(__dirname, '../../migrations')
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const filename of files) {
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT filename FROM schema_migrations WHERE filename = ?',
        [filename]
      )
      if (Array.isArray(rows) && rows.length > 0) continue

      if (filename === '008_users_is_admin.sql') {
        await ensureUsersIsAdminColumn(conn)
      }
      if (filename === '009_app_parameters_remark.sql') {
        await ensureAppParametersRemarkColumn(conn)
      }

      const sql = await readFile(join(migrationsDir, filename), 'utf8')
      await conn.beginTransaction()
      try {
        for (const statement of splitSqlStatements(sql)) {
          if (statement) await conn.query(statement)
        }
        await conn.query('INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)', [
          filename,
          Date.now(),
        ])
        await conn.commit()
        console.info(`[migrate] applied ${filename}`)
      } catch (e) {
        await conn.rollback()
        throw e
      }
    }

    await ensureUsersIsAdminColumn(conn)
    await ensureAppParametersRemarkColumn(conn)
    await ensureUsersInvitedByColumn(conn)
  } finally {
    conn.release()
  }
}

/** 列可能已手工添加但 008 未记入 schema_migrations，避免重复 ADD 导致启动失败 */
async function ensureUsersIsAdminColumn(conn: PoolConnection): Promise<void> {
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  )
  if (!Number(tables[0]?.c)) return

  const [cols] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_admin'`
  )
  if (!Number(cols[0]?.c)) {
    await conn.query(
      `ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0
       COMMENT '是否系统管理员：1 可调用 /admin/* 维护 app_parameters'`
    )
    console.info('[migrate] added users.is_admin')
  }
}

async function ensureAppParametersRemarkColumn(conn: PoolConnection): Promise<void> {
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_parameters'`
  )
  if (!Number(tables[0]?.c)) return

  const [cols] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_parameters' AND COLUMN_NAME = 'remark'`
  )
  if (!Number(cols[0]?.c)) {
    await conn.query(
      `ALTER TABLE app_parameters ADD COLUMN remark VARCHAR(512) NULL
       COMMENT '参数说明，便于运维与开发查阅维护'`
    )
    console.info('[migrate] added app_parameters.remark')
  }
}

/** 列或外键可能已由手工执行过 002 旧版 SQL，避免重复 ADD 导致启动失败 */
async function ensureUsersInvitedByColumn(conn: PoolConnection): Promise<void> {
  const [tables] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  )
  if (!Number(tables[0]?.c)) return

  const [cols] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'invited_by_user_id'`
  )
  if (!Number(cols[0]?.c)) {
    await conn.query(
      'ALTER TABLE users ADD COLUMN invited_by_user_id CHAR(36) NULL'
    )
    console.info('[migrate] added users.invited_by_user_id')
  }

  const [fks] = await conn.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_invited_by'`
  )
  if (!Number(fks[0]?.c)) {
    await conn.query(
      `ALTER TABLE users
       ADD CONSTRAINT fk_users_invited_by FOREIGN KEY (invited_by_user_id) REFERENCES users (id) ON DELETE SET NULL`
    )
    console.info('[migrate] added fk_users_invited_by')
  }
}

function splitSqlStatements(sql: string): string[] {
  const lines = sql.split(/\r?\n/)
  let cur = ''
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('--')) continue
    cur += line + '\n'
  }
  return cur
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
}
