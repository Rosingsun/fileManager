import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import { env } from '../config/env.js'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      /** 避免连接池耗尽时 getConnection 无限排队 */
      queueLimit: 50,
      namedPlaceholders: true,
      connectTimeout: 10_000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      /** 归还池前重置会话状态，减少未提交事务污染连接 */
      resetOnRelease: true,
    })
    pool.on('connection', (connection) => {
      /** `connection` 为底层回调式连接，须用 query(sql, cb)，不能用 .then/.catch */
      const c = connection as unknown as { query: (sql: string, cb: (err: unknown) => void) => void }
      c.query('SET SESSION innodb_lock_wait_timeout = 10', () => {
        /* 非 InnoDB / 权限不足时忽略 */
      })
    })
  }
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
