import { randomUUID } from 'node:crypto'
import { getPool } from '../../db/pool.js'
import { generateInvitePlain, hashInviteCode, normalizeInviteCode } from '../../utils/inviteCode.js'
import { AppError } from '../../utils/AppError.js'
import * as authRepo from '../auth/auth.repository.js'
import * as paramsRepo from '../parameters/parameters.repository.js'
import * as repo from './invite.repository.js'

const INVITE_CODE_VALID_DAYS = 3
const INVITE_CODE_TTL_MS = INVITE_CODE_VALID_DAYS * 24 * 60 * 60 * 1000

function utcDayStartMs(now: number): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export const inviteService = {
  async getQuota(inviterUserId: string): Promise<{
    maxInvitees: number
    redeemedCount: number
    maxGenerationsPerDay: number
    generationsToday: number
  }> {
    const pool = getPool()
    const now = Date.now()
    const dayStart = utcDayStartMs(now)
    const [maxInvitees, redeemedCount, maxGenerationsPerDay, generationsToday] = await Promise.all([
      paramsRepo.getInviteMaxRedemptionsPerInviter(pool),
      repo.countRedemptionsByInviter(pool, inviterUserId),
      paramsRepo.getInviteMaxGenerationsPerDay(pool),
      repo.countInviteCodesCreatedSince(pool, inviterUserId, dayStart),
    ])
    return { maxInvitees, redeemedCount, maxGenerationsPerDay, generationsToday }
  },

  async createInvite(inviterUserId: string, body: unknown): Promise<{
    id: string
    code: string
    createdAt: number
    expiresAt: number
    maxUses: number
  }> {
    void body
    const plain = generateInvitePlain()
    const hash = hashInviteCode(normalizeInviteCode(plain))
    const id = randomUUID()
    const now = Date.now()
    const maxUses = 1
    const expiresAt = now + INVITE_CODE_TTL_MS
    const note: string | null = null

    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const locked = await authRepo.lockUserByIdForUpdate(conn, inviterUserId)
      if (!locked) {
        throw new AppError(404, 'USER_NOT_FOUND', '用户不存在')
      }
      const maxInvitees = await paramsRepo.getInviteMaxRedemptionsPerInviter(conn)
      const redeemedCount = await repo.countRedemptionsByInviter(conn, inviterUserId)
      if (redeemedCount >= maxInvitees) {
        throw new AppError(403, 'INVITE_QUOTA_EXCEEDED', '已达邀请人数上限')
      }
      const maxPerDay = await paramsRepo.getInviteMaxGenerationsPerDay(conn)
      const dayStart = utcDayStartMs(now)
      const generatedToday = await repo.countInviteCodesCreatedSince(conn, inviterUserId, dayStart)
      if (generatedToday >= maxPerDay) {
        throw new AppError(403, 'INVITE_DAILY_GENERATION_LIMIT', '今日生成邀请码次数已达上限')
      }
      await repo.revokeActiveInvitesByInviter(conn, inviterUserId, now)
      await repo.insertInviteCode(conn, {
        id,
        code_hash: hash,
        invite_plain: plain,
        inviter_user_id: inviterUserId,
        note,
        created_at: now,
        expires_at: expiresAt,
        max_uses: maxUses,
      })
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }

    return { id, code: plain, createdAt: now, expiresAt, maxUses }
  },

  async listMyCodes(inviterUserId: string) {
    const rows = await repo.listInviteCodesByInviter(getPool(), inviterUserId)
    const now = Date.now()
    return rows.map((r) => ({
      id: r.id,
      code: r.invite_plain,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      maxUses: r.max_uses,
      usedCount: r.used_count,
      revokedAt: r.revoked_at,
      note: r.note,
      remainingSlots: Math.max(0, r.max_uses - r.used_count),
      isValid:
        r.revoked_at == null &&
        (r.expires_at == null || now <= r.expires_at) &&
        r.used_count < r.max_uses,
    }))
  },

  async listMyRecords(inviterUserId: string) {
    const rows = await repo.listRedemptionsByInviter(getPool(), inviterUserId)
    return rows.map((r) => ({
      id: r.id,
      inviteCodeId: r.invite_code_id,
      inviteeUserId: r.invitee_user_id,
      inviteeEmail: r.invitee_email_snapshot,
      redeemedAt: r.redeemed_at,
    }))
  },
}
