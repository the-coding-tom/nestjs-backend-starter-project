import * as crypto from 'crypto';

export function generateSessionToken(): string {
  const randomBytes = crypto.randomBytes(32);
  return crypto.createHash('sha256').update(randomBytes).digest('hex');
}
