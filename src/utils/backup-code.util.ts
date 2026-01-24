import * as crypto from 'crypto';
import * as Chance from 'chance';

const chance = new Chance();

export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(chance.string({ length: 8, pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' }));
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function verifyBackupCode(providedCode: string, hashedCode: string): boolean {
  const hashedProvidedCode = hashBackupCode(providedCode);
  return hashedProvidedCode === hashedCode;
}
