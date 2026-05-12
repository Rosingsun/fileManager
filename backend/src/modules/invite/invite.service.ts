import { randomUUID } from 'node:crypto'
import { getPool } from '../../db/pool.js'
import { generateInvitePlain, hashInviteCode, normalizeInviteCode } from '../../utils/inviteCode.js'
import * as repo from './invite.repository.js'

export const inviteService = {
  async createInvite(inviterUserId: string, body: unknown): Promise<{
    id: string
    code: string
    createdAt: number
    expiresAt: number | null
    maxUses: number
  }> {
    const b = body as { maxUses?: number; expiresInDays?: number | null; note?: string | null }
    const plain = generateInvitePlain()
    const hash = hashInviteCode(normalizeInviteCode(plain))
    const id = randomUUID()
    const now = Date.now()
    let maxUses = 1
    if (typeof b?.maxUses === 'number' && Number.isFinite(b.maxUses)) {
      maxUses = Math.min(1000, Math.max(1, Math.floor(b.maxUses)))
    }
    let expiresAt: number | null = null
    if (typeof b?.expiresInDays === 'number' && b.expiresInDays > 0) {
      expiresAt = now + Math.min(3650, b.expiresInDays) * 24 * 60 * 60 * 1000
    }
    const note =
      typeof b?.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 255) : null

    await repo.insertInviteCode(getPool(), {
      id,
      code_hash: hash,
      inviter_user_id: inviterUserId,
      note,
      created_at: now,
      expires_at: expiresAt,
      max_uses: maxUses,
    })

    return { id, code: plain, createdAt: now, expiresAt, maxUses }
  },

  async listMyCodes(inviterUserId: string) {
    const rows = await repo.listInviteCodesByInviter(getPool(), inviterUserId)
    const now = Date.now()
    return rows.map((r) => ({
      id: r.id,
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
