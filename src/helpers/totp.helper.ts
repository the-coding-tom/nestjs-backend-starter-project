import * as speakeasy from 'speakeasy';
import { config } from '../config/config';

/**
 * TOTP Helper Functions
 *
 * Pure functions for TOTP verification. No I/O operations.
 * For TOTP setup with QR code generation (I/O), use MfaService instead.
 */

/**
 * Verify a TOTP code against a secret
 * This is a pure function - no I/O, just computation
 */
export function verifyTotpCode(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: config.mfa.totpWindow,
  });
}
