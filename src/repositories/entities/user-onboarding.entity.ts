import { VerificationRequestType, SubscriptionStatus, BillingInterval, OAuthProvider } from '@prisma/client';

export class CreateUserWithWorkspaceAndSubscriptionData {
  // User data
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  timezone: string;
  language: string;
  status: string;
  type: string;
  emailVerifiedAt: Date | null;
  passwordHash?: string; // For local auth

  // Verification request data (optional, for local auth)
  verificationRequest?: {
    token: string;
    type: VerificationRequestType;
    expiresAt: Date;
  };

  // Workspace data
  workspaceName: string;
  slug: string;

  // Plan ID for subscription
  planId: number;
  subscriptionStatus: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
}

export class CreateOAuthUserWithWorkspaceAndSubscriptionData {
  // User data
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  timezone: string;
  language: string;
  status: string;
  type: string;
  emailVerifiedAt: Date | null;

  // OAuth account data
  oauthProvider: OAuthProvider;
  oauthProviderUserId: string;
  oauthAccessToken: string;
  oauthRefreshToken?: string | null;
  oauthExpiresAt?: number | null;
  oauthMetadata?: any;

  // Workspace data
  workspaceName: string;
  slug: string;

  // Plan ID for subscription
  planId: number;
  subscriptionStatus: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
}

