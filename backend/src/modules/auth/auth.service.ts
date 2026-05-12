import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { env } from '../../config/env.js'
import { getPool } from '../../db/pool.js'
import {
  hashRefreshToken,
  newRefreshToken,
  signAccessToken,
  refreshExpiresAt,
} from '../../tokens.js'
import { INVITE_INVALID_MESSAGE, hashInviteCode, normalizeInviteCode } from '../../utils/inviteCode.js'
import { AppError } from '../../utils/AppError.js'
import * as inviteRepo from '../invite/invite.repository.js'
import type { InviteCodeRow } from '../invite/invite.repository.js'
import * as repo from './auth.repository.js'
import type { UserRow } from './auth.repository.js'

export type PublicUser = {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  invitedByUserId?: string | null
}

export function toPublicUser(
  row: Pick<UserRow, 'id' | 'email' | 'display_name' | 'avatar_url'> & { invited_by_user_id?: string | null }
): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    invitedByUserId: row.invited_by_user_id ?? null,
  }
}

function safeEqualSha256(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

function validateInviteRow(row: InviteCodeRow, now: number): void {
  if (row.revoked_at != null) {
    throw new AppError(400, 'INVALID_INVITE', INVITE_INVALID_MESSAGE)
  }
  if (row.expires_at != null && now > row.expires_at) {
    throw new AppError(400, 'INVALID_INVITE', INVITE_INVALID_MESSAGE)
  }
  if (row.used_count >= row.max_uses) {
    throw new AppError(400, 'INVALID_INVITE', INVITE_INVALID_MESSAGE)
  }
}

async function issueRefreshPairAsync(conn: repo.DbExecutor, userId: string): Promise<{ raw: string }> {
  const raw = newRefreshToken()
  const tokenHash = hashRefreshToken(raw)
  const now = Date.now()
  await repo.insertRefreshToken(conn, {
    id: randomUUID(),
    user_id: userId,
    token_hash: tokenHash,
    expires_at: refreshExpiresAt(),
    created_at: now,
  })
  return { raw }
}

export const authService = {
  async bootstrapFirstUser(
    body: unknown
  ): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    const b = body as { secret?: string }
    const secret = typeof b?.secret === 'string' ? b.secret : ''
    if (!env.BOOTSTRAP_INVITE_SECRET || env.BOOTSTRAP_INVITE_SECRET.length < 16) {
      throw new AppError(403, 'BOOTSTRAP_DISABLED', '未启用引导注册')
    }
    if (!safeEqualSha256(secret, env.BOOTSTRAP_INVITE_SECRET)) {
      throw new AppError(403, 'INVALID_SECRET', '密钥错误')
    }
    const pool = getPool()
    const n = await repo.countUsers(pool)
    if (n > 0) {
      throw new AppError(403, 'BOOTSTRAP_ALREADY_DONE', '已有用户，无法再次引导注册')
    }
    const { email, password, displayName } = parseRegisterBody(body, true)
    const id = randomUUID()
    const passwordHash = await bcrypt.hash(password, 12)
    const now = Date.now()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await repo.insertUser(conn, {
        id,
        email,
        password_hash: passwordHash,
        display_name: displayName,
        avatar_url: null,
        created_at: now,
        invited_by_user_id: null,
      })
      const { raw: refreshToken } = await issueRefreshPairAsync(conn, id)
      await conn.commit()
      const accessToken = signAccessToken(id, env.JWT_SECRET)
      return {
        accessToken,
        refreshToken,
        user: toPublicUser({
          id,
          email,
          display_name: displayName,
          avatar_url: null,
          invited_by_user_id: null,
        }),
      }
    } catch (e) {
      await conn.rollback()
      if (repo.isDuplicateKeyError(e)) {
        throw new AppError(409, 'EMAIL_IN_USE', '该邮箱已被注册')
      }
      throw e
    } finally {
      conn.release()
    }
  },

  async register(body: unknown): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    const allowOpen = env.ALLOW_OPEN_REGISTRATION
    const { email, password, displayName, inviteCodeNormalized } = parseRegisterBody(body, allowOpen)
    const pool = getPool()
    const id = randomUUID()
    const passwordHash = await bcrypt.hash(password, 12)
    const now = Date.now()
    const conn = await pool.getConnection()

    let invitedByUserId: string | null = null
    let inviteCodeId: string | null = null
    let inviterForRedemption: string | null = null

    try {
      await conn.beginTransaction()

      if (!allowOpen || inviteCodeNormalized) {
        if (!allowOpen && !inviteCodeNormalized) {
          throw new AppError(400, 'INVITE_REQUIRED', '需要填写邀请码')
        }
        if (inviteCodeNormalized) {
          const codeHash = hashInviteCode(inviteCodeNormalized)
          const icRow = await inviteRepo.lockInviteCodeByHash(conn, codeHash)
          if (!icRow) {
            throw new AppError(400, 'INVALID_INVITE', INVITE_INVALID_MESSAGE)
          }
          validateInviteRow(icRow, now)
          invitedByUserId = icRow.inviter_user_id
          inviteCodeId = icRow.id
          inviterForRedemption = icRow.inviter_user_id
        }
      }

      await repo.insertUser(conn, {
        id,
        email,
        password_hash: passwordHash,
        display_name: displayName,
        avatar_url: null,
        created_at: now,
        invited_by_user_id: invitedByUserId,
      })

      if (inviteCodeId && inviterForRedemption) {
        await inviteRepo.insertRedemption(conn, {
          id: randomUUID(),
          invite_code_id: inviteCodeId,
          inviter_user_id: inviterForRedemption,
          invitee_user_id: id,
          invitee_email_snapshot: email,
          redeemed_at: now,
        })
        await inviteRepo.incrementInviteUsedCount(conn, inviteCodeId)
      }

      const { raw: refreshToken } = await issueRefreshPairAsync(conn, id)
      await conn.commit()
      const accessToken = signAccessToken(id, env.JWT_SECRET)
      return {
        accessToken,
        refreshToken,
        user: toPublicUser({
          id,
          email,
          display_name: displayName,
          avatar_url: null,
          invited_by_user_id: invitedByUserId,
        }),
      }
    } catch (e) {
      await conn.rollback()
      if (repo.isDuplicateKeyError(e)) {
        throw new AppError(409, 'EMAIL_IN_USE', '该邮箱已被注册')
      }
      throw e
    } finally {
      conn.release()
    }
  },

  async login(body: unknown): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    const { email, password } = parseLoginBody(body)
    const pool = getPool()
    const row = await repo.findUserByEmail(pool, email)
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', '邮箱或密码错误')
    }
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const { raw: refreshToken } = await issueRefreshPairAsync(conn, row.id)
      await conn.commit()
      return {
        accessToken: signAccessToken(row.id, env.JWT_SECRET),
        refreshToken,
        user: toPublicUser(row),
      }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  },

  async refresh(body: unknown): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    const raw = typeof (body as { refreshToken?: string })?.refreshToken === 'string' ? (body as { refreshToken: string }).refreshToken : ''
    if (!raw) {
      throw new AppError(400, 'MISSING_REFRESH', '缺少 refreshToken')
    }
    const tokenHash = hashRefreshToken(raw)
    const pool = getPool()
    const rec = await repo.findRefreshByHash(pool, tokenHash)
    if (!rec || rec.expires_at < Date.now()) {
      if (rec) await repo.deleteRefreshByHash(pool, tokenHash)
      throw new AppError(401, 'INVALID_REFRESH', '刷新令牌无效或已过期')
    }
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await repo.deleteRefreshByHash(conn, tokenHash)
      const user = await repo.findUserById(conn, rec.user_id)
      if (!user) {
        await conn.rollback()
        throw new AppError(401, 'INVALID_REFRESH', '刷新令牌无效或已过期')
      }
      const { raw: refreshToken } = await issueRefreshPairAsync(conn, user.id)
      await conn.commit()
      return {
        accessToken: signAccessToken(user.id, env.JWT_SECRET),
        refreshToken,
        user: toPublicUser(user),
      }
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  },

  async logout(body: unknown): Promise<void> {
    const raw =
      typeof (body as { refreshToken?: string })?.refreshToken === 'string'
        ? (body as { refreshToken: string }).refreshToken
        : ''
    if (raw) {
      await repo.deleteRefreshByHash(getPool(), hashRefreshToken(raw))
    }
  },
}

function parseRegisterBody(
  body: unknown,
  allowOpen: boolean
): { email: string; password: string; displayName: string; inviteCodeNormalized: string | undefined } {
  const b = body as { email?: string; password?: string; displayName?: string; inviteCode?: string }
  const email = typeof b?.email === 'string' ? b.email.trim().toLowerCase() : ''
  const password = typeof b?.password === 'string' ? b.password : ''
  const displayName =
    typeof b?.displayName === 'string' && b.displayName.trim()
      ? b.displayName.trim()
      : email.split('@')[0] || '用户'
  const inviteRaw = typeof b?.inviteCode === 'string' ? b.inviteCode : ''
  const inviteCodeNormalized = inviteRaw.trim() ? normalizeInviteCode(inviteRaw) : undefined

  if (!allowOpen && !inviteCodeNormalized) {
    throw new AppError(400, 'INVITE_REQUIRED', '需要填写邀请码')
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'INVALID_EMAIL', '邮箱格式不正确')
  }
  if (password.length < 8) {
    throw new AppError(400, 'PASSWORD_TOO_SHORT', '密码至少 8 位')
  }
  return { email, password, displayName, inviteCodeNormalized }
}

function parseLoginBody(body: unknown): { email: string; password: string } {
  const b = body as { email?: string; password?: string }
  const email = typeof b?.email === 'string' ? b.email.trim().toLowerCase() : ''
  const password = typeof b?.password === 'string' ? b.password : ''
  if (!email || !password) {
    throw new AppError(400, 'INVALID_REQUEST', '请填写邮箱和密码')
  }
  return { email, password }
}
