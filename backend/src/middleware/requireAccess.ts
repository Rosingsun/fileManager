import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.js'
import { verifyAccessToken } from '../tokens.js'

export function requireAccess(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({
      ok: false as const,
      error: { code: 'UNAUTHORIZED', message: '未登录或令牌无效' },
    })
    return
  }
  const token = auth.slice(7).trim()
  if (!token) {
    res.status(401).json({
      ok: false as const,
      error: { code: 'UNAUTHORIZED', message: '未登录或令牌无效' },
    })
    return
  }
  try {
    const { sub } = verifyAccessToken(token, env.JWT_SECRET)
    req.userId = sub
    next()
  } catch {
    res.status(401).json({
      ok: false as const,
      error: { code: 'UNAUTHORIZED', message: '未登录或令牌无效' },
    })
  }
}
