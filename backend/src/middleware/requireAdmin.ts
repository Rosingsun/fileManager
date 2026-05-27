import type { Request, Response, NextFunction } from 'express'
import { getPool } from '../db/pool.js'
import { isUserAdmin } from '../modules/auth/auth.repository.js'

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({
      ok: false as const,
      error: { code: 'UNAUTHORIZED', message: '未登录或令牌无效' },
    })
    return
  }
  try {
    const admin = await isUserAdmin(getPool(), userId)
    if (!admin) {
      res.status(403).json({
        ok: false as const,
        error: { code: 'FORBIDDEN', message: '需要管理员权限' },
      })
      return
    }
    next()
  } catch {
    res.status(500).json({
      ok: false as const,
      error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
    })
  }
}
