import crypto from 'crypto'
import jwt from 'jsonwebtoken'

const ACCESS_EXPIRES = '15m'
const REFRESH_DAYS = 30

export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export function newRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function signAccessToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId, typ: 'access' }, secret, { expiresIn: ACCESS_EXPIRES })
}

export function verifyAccessToken(token: string, secret: string): { sub: string } {
  const payload = jwt.verify(token, secret) as jwt.JwtPayload
  if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('invalid_token')
  }
  return { sub: payload.sub }
}

export function refreshExpiresAt(): number {
  return Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000
}
