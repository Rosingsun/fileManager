import type { Request, Response, NextFunction } from 'express'
import { writeAppLog } from '../logger/appLogger.js'
import { AppError } from '../utils/AppError.js'

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err)
    return
  }
  if (err instanceof AppError) {
    const rid = req.requestId ?? '-'
    const path = `${req.method} ${req.originalUrl || req.url}`
    writeAppLog('WARN', `AppError ${err.code} (${err.statusCode}) ${path} rid=${rid}`, err.message)
    res.status(err.statusCode).json({
      ok: false as const,
      error: { code: err.code, message: err.message },
    })
    return
  }
  const rid = req.requestId ?? '-'
  const path = `${req.method} ${req.originalUrl || req.url}`
  const detail = err instanceof Error ? err.stack || err.message : String(err)
  writeAppLog('ERROR', `[auth-api] ${path} rid=${rid}`, detail)
  res.status(500).json({
    ok: false as const,
    error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
  })
}
