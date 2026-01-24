import { MfaMethod, MfaChallengeSessionStatus } from '@prisma/client';

export class CreateMfaChallengeSessionData {
  userId: number;
  email: string;
  mfaMethod: MfaMethod;
  sessionToken: string;
  expiresAt: Date;
  status?: MfaChallengeSessionStatus;
}

export class UpdateMfaChallengeSessionData {
  status?: MfaChallengeSessionStatus;
}

