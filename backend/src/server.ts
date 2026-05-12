import { env } from './config/env.js'
import { getPool, closePool } from './db/pool.js'
import { runMigrations } from './db/runMigrations.js'
import { createApp } from './app.js'
import { writeAppLog } from './logger/appLogger.js'

const pool = getPool()
await runMigrations(pool)

const app = createApp()
const server = app.listen(env.PORT, '0.0.0.0', () => {
  const msg = `[auth-api] listening on http://127.0.0.1:${env.PORT} (log root: ${env.LOG_ROOT})`
  writeAppLog('INFO', msg)
})

function shutdown(signal: string): void {
  writeAppLog('INFO', `[auth-api] ${signal}, closing...`)
  server.close(() => {
    void closePool().finally(() => process.exit(0))
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
