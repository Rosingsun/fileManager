import { randomUUID } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID()
  res.setHeader('X-Request-Id', id)
  req.requestId = id
  next()
}
