// ============================================================================
// Registration & Login
// ============================================================================

export class LoginDto {
  email: string;
  password: string;
  /** When true, session lasts 30 days; otherwise 1 day. */
  rememberMe?: boolean;
}

export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  /** Access token TTL in seconds; frontend can use this to refresh before expiry. */
  expiresIn: number;
  user: {
    id: number;
    email: string;
    name?: string | null;
    photoUrl?: string | null;
    isEmailVerified: boolean;
    status: string;
  };
}

export class LogoutDto {
  refreshToken: string;
}

export class RegisterDto {
  email: string;
  password: string;
  name: string;
}

// ============================================================================
// Token Management
// ============================================================================

export class RefreshTokenDto {
  refreshToken: string;
}

export class RefreshTokenResponseDto {
  accessToken: string;
  refreshToken: string;
  /** Access token TTL in seconds; frontend can use this to refresh before expiry. */
  expiresIn: number;
}

// ============================================================================
// Email Verification
// ============================================================================

export class VerifyEmailDto {
  token: string;
}

export class ResendVerificationDto {
  email: string;
}

// ============================================================================
// Password Reset
// ============================================================================

export class ResetPasswordRequestDto {
  email: string;
}

export class ResetPasswordConfirmDto {
  token: string;
  newPassword: string;
}

export class ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

// ============================================================================
// OAuth
// ============================================================================

export class OAuthCallbackDto {
  code?: string;
  state?: string;
  scope?: string;
  authuser?: string;
  prompt?: string;
  error?: string;
  error_description?: string;
}

export class OAuthUrlResponseDto {
  provider: string;
  url: string;
}

export class OAuthLoginResponseDto {
  accessToken: string;
  refreshToken: string;
  /** Access token TTL in seconds; frontend can use this to refresh before expiry. */
  expiresIn: number;
  user: {
    id: number;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
    isEmailVerified: boolean;
    status: string;
  };
}

// ============================================================================
// MFA - Request DTOs
// ============================================================================

export class MfaVerifyDto {
  code: string;
}

export class MfaChallengeDto {
  code: string;
  sessionToken: string;
  /** Must match the rememberMe sent at login; used for session expiry. */
  rememberMe?: boolean;
}

export class MfaBackupCodeConsumeDto {
  code: string;
  sessionToken: string;
  /** Must match the rememberMe sent at login; used for session expiry. */
  rememberMe?: boolean;
}

export class MfaDisableDto {
  code: string; // Accepts both TOTP (6 digits) and backup code (8 characters)
}

export class MfaRegenerateBackupCodesDto {
  code: string; // TOTP code (6 digits)
}

// ============================================================================
// MFA - Response DTOs
// ============================================================================

export class TotpSetupResponseDto {
  qrCode: string;
  manualEntryKey: string;
  issuer: string;
  accountName: string;
}

export class TotpVerifySetupResponseDto {
  backupCodes: string[];
}

export class BackupCodesResponseDto {
  remainingCount: number;
  codes: string[]; // Empty array - codes are stored as hashes and only shown once when generated
}

export class RegenerateBackupCodesResponseDto {
  backupCodes: string[];
}