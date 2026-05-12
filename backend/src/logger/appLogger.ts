import { mkdirSync, appendFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { env } from '../config/env.js'

type LogLevel = 'INFO' | 'WARN' | 'ERROR'

function pathForDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const dir = resolve(env.LOG_ROOT, String(y), m)
  const name = `${y}-${m}-${day}.log`
  return join(dir, name)
}

function formatDetail(detail?: string): string {
  if (detail == null || detail === '') return ''
  const oneLine = detail.replace(/\r?\n/g, ' | ')
  return ` | ${oneLine}`
}

export function writeAppLog(level: LogLevel, message: string, detail?: string): void {
  const d = new Date()
  const filePath = pathForDate(d)
  mkdirSync(dirname(filePath), { recursive: true })
  const ts = d.toISOString()
  const line = `[${ts}] [${level}] ${message}${formatDetail(detail)}\n`
  try {
    appendFileSync(filePath, line, 'utf8')
  } catch (e) {
    process.stderr.write(`[appLogger] append failed: ${String(e)}\n${line}`)
  }
  if (level === 'ERROR') {
    process.stderr.write(line)
  } else {
    process.stdout.write(line)
  }
}
