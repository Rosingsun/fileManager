import type { Request, Response, NextFunction } from 'express'
import { writeAppLog } from '../logger/appLogger.js'

export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()
  const path = req.originalUrl || req.url
  const ip = req.socket.remoteAddress ?? '-'
  const rid = req.requestId ?? '-'
  writeAppLog('INFO', `-> ${req.method} ${path} rid=${rid} ip=${ip}`)

  let finished = false
  res.on('finish', () => {
    finished = true
    const ms = Date.now() - start
    const msg = `${req.method} ${path} ${res.statusCode} ${ms}ms ip=${ip} rid=${rid}`
    writeAppLog('INFO', msg)
  })
  res.on('close', () => {
    if (!finished) {
      writeAppLog('WARN', `client closed before response ${req.method} ${path} rid=${rid} ${Date.now() - start}ms`)
    }
  })
  next()
}
