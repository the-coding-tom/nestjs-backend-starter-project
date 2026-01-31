// ============================================================================
// Profile
// ============================================================================

export class ProfileResponseDto {
  id: number;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  timezone: string;
  language: string;
  isEmailVerified: boolean;
  status: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export class UpdateProfileDto {
  name?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string | null;
  timezone?: string;
  language?: string;
}
