import { UserStatus, UserType, OAuthProvider, Prisma } from '@prisma/client';

export interface LocalAuthAccountEntity {
  id: number;
  userId: number;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthAccountEntity {
  id: number;
  userId: number;
  provider: OAuthProvider;
  providerUserId: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  tokenType: string | null;
  scope: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateUserData {
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
  timezone?: string;
  language?: string;
  status?: UserStatus;
  type?: UserType;
  emailVerifiedAt?: Date | null;
  localAuthAccount?: {
    create: {
      passwordHash: string;
    };
  };
}

export class UpdateUserData {
  firstName?: string | null;
  lastName?: string | null;
  emailVerifiedAt?: Date | null;
  status?: UserStatus;
  type?: UserType;
  name?: string | null;
  photoUrl?: string | null;
  timezone?: string;
  language?: string;
  totpEnabled?: boolean;
  totpSecret?: string | null;
}

export class UserEntity {
  id: number;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  timezone: string;
  language: string;
  status: UserStatus;
  type: UserType;
  emailVerifiedAt: Date | null;
  totpEnabled: boolean;
  totpSecret: string | null;
  dateInvited: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithLocalAuthEntity extends UserEntity {
  localAuthAccount: LocalAuthAccountEntity | null;
}

export interface UserWithOAuthEntity extends UserEntity {
  oauthAccounts: OAuthAccountEntity[];
}

export interface UserWithAuthEntity extends UserEntity {
  localAuthAccount: LocalAuthAccountEntity | null;
  oauthAccounts: OAuthAccountEntity[];
}

