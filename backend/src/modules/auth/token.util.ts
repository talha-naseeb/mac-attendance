import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function generateRefreshSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function refreshTokenMatches(secret: string, hash: string): boolean {
  const presented = Buffer.from(hashRefreshSecret(secret), 'hex');
  const stored = Buffer.from(hash, 'hex');
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}

export function formatRefreshToken(sessionId: string, secret: string): string {
  return `${sessionId}.${secret}`;
}

export function parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
  const separator = token.indexOf('.');
  if (separator <= 0 || separator === token.length - 1) return null;
  return { sessionId: token.slice(0, separator), secret: token.slice(separator + 1) };
}
