import type { Request, Response, NextFunction } from 'express'
import { writeAppLog } from '../logger/appLogger.js'

export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    const ip = req.socket.remoteAddress ?? '-'
    const rid = req.requestId ?? '-'
    const msg = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${ms}ms ip=${ip} rid=${rid}`
    writeAppLog('INFO', msg)
  })
  next()
}
