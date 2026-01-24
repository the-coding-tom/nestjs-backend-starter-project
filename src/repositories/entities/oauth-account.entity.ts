import { OAuthProvider } from '@prisma/client';

export class CreateOAuthAccountData {
  userId: number;
  provider: OAuthProvider;
  providerUserId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  tokenType?: string | null;
  scope?: string | null;
  metadata?: any;
  [key: string]: any;
}

export class UpdateOAuthAccountData {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  tokenType?: string | null;
  scope?: string | null;
  metadata?: any;
  [key: string]: any;
}

