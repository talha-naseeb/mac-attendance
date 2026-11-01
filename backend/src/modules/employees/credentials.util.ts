import { randomBytes } from 'crypto';

export function generateTemporaryPassword(): string {
  const body = randomBytes(9).toString('base64url').slice(0, 12);
  return `Mq${body}9!`;
}
