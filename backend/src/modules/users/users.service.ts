import bcrypt from 'bcryptjs'
import { getPool } from '../../db/pool.js'
import { AppError } from '../../utils/AppError.js'
import * as repo from '../auth/auth.repository.js'
import { toPublicUser, type PublicUser } from '../auth/auth.service.js'

export const usersService = {
  async getMe(userId: string): Promise<PublicUser> {
    const row = await repo.findUserById(getPool(), userId)
    if (!row) {
      throw new AppError(401, 'UNAUTHORIZED', '未登录或令牌无效')
    }
    return toPublicUser(row)
  },

  async patchMe(userId: string, body: unknown): Promise<PublicUser> {
    const pool = getPool()
    const row = await repo.findUserById(pool, userId)
    if (!row) {
      throw new AppError(401, 'UNAUTHORIZED', '未登录或令牌无效')
    }

    const b = body as { displayName?: string; avatarUrl?: string | null }
    let displayName: string | undefined
    if (typeof b?.displayName === 'string') {
      const t = b.displayName.trim()
      if (t.length > 64) {
        throw new AppError(400, 'DISPLAY_NAME_TOO_LONG', '昵称最长 64 字符')
      }
      displayName = t || row.display_name
    }

    let nextAvatar = row.avatar_url
    if (b && 'avatarUrl' in b) {
      if (b.avatarUrl === null || b.avatarUrl === '') {
        nextAvatar = null
      } else if (typeof b.avatarUrl === 'string') {
        const u = b.avatarUrl.trim()
        if (u.length > 512) {
          throw new AppError(400, 'AVATAR_URL_TOO_LONG', '头像 URL 最长 512 字符')
        }
        nextAvatar = u
      }
    }

    const nextDisplay = displayName !== undefined ? displayName : row.display_name
    await repo.updateUserProfile(pool, userId, nextDisplay, nextAvatar)
    const updated = await repo.findUserById(pool, userId)
    if (!updated) {
      throw new AppError(401, 'UNAUTHORIZED', '未登录或令牌无效')
    }
    return toPublicUser(updated)
  },

  async changePassword(userId: string, body: unknown): Promise<{ ok: true }> {
    const b = body as { currentPassword?: string; newPassword?: string }
    const currentPassword = typeof b?.currentPassword === 'string' ? b.currentPassword : ''
    const newPassword = typeof b?.newPassword === 'string' ? b.newPassword : ''
    if (!currentPassword || !newPassword) {
      throw new AppError(400, 'INVALID_REQUEST', '请填写当前密码与新密码')
    }
    if (newPassword.length < 8) {
      throw new AppError(400, 'PASSWORD_TOO_SHORT', '新密码至少 8 位')
    }
    if (currentPassword === newPassword) {
      throw new AppError(400, 'PASSWORD_UNCHANGED', '新密码不能与当前密码相同')
    }

    const pool = getPool()
    const row = await repo.findUserById(pool, userId)
    if (!row) {
      throw new AppError(401, 'UNAUTHORIZED', '未登录或令牌无效')
    }
    if (!(await bcrypt.compare(currentPassword, row.password_hash))) {
      throw new AppError(400, 'WRONG_PASSWORD', '当前密码不正确')
    }

    const password_hash = await bcrypt.hash(newPassword, 12)
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await repo.updatePasswordHash(conn, userId, password_hash)
      await repo.deleteRefreshTokensForUser(conn, userId)
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
    return { ok: true }
  },
}
