import crypto from 'crypto'

const INVITE_INVALID_MESSAGE = '邀请码无效或已失效'

export function normalizeInviteCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase()
}

export function hashInviteCode(normalized: string): string {
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex')
}

export function generateInvitePlain(): string {
  const hex = crypto.randomBytes(8).toString('hex').toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`
}

export { INVITE_INVALID_MESSAGE }
