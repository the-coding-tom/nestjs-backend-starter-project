import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { UserStatus, UserType, WorkspaceMemberRole } from '@prisma/client';
import {
  CreateUserData,
  UpdateUserData,
  UserEntity,
  UserWithAuthEntity,
  UserWithLocalAuthEntity,
  UserWithOAuthEntity,
} from './entities/user.entity';
import {
  CreateUserWithWorkspaceAndSubscriptionData,
  CreateOAuthUserWithWorkspaceAndSubscriptionData,
} from './entities/user-onboarding.entity';

@Injectable()
export class UserRepository {
  /**
   * Create a user with local auth account
   */
  async createLocalAuthUser(userData: CreateUserData): Promise<UserWithLocalAuthEntity> {
    return prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        firstName: userData.firstName,
        lastName: userData.lastName,
        photoUrl: userData.photoUrl,
        timezone: userData.timezone,
        language: userData.language,
        status: userData.status,
        type: userData.type,
        emailVerifiedAt: userData.emailVerifiedAt,
        localAuthAccount: userData.localAuthAccount,
      },
      include: {
        localAuthAccount: true,
      },
    });
  }

  /**
   * Create a user with OAuth account
   */
  async createOAuthUser(userData: CreateUserData): Promise<UserWithOAuthEntity> {
    return prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        firstName: userData.firstName,
        lastName: userData.lastName,
        photoUrl: userData.photoUrl,
        timezone: userData.timezone,
        language: userData.language,
        status: userData.status,
        type: userData.type,
        emailVerifiedAt: userData.emailVerifiedAt,
      },
      include: {
        oauthAccounts: true,
      },
    });
  }

  async findById(id: number): Promise<UserWithAuthEntity | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        localAuthAccount: true,
        oauthAccounts: true,
      },
    });
  }

  async findByEmail(email: string): Promise<UserWithAuthEntity | null> {
    return prisma.user.findUnique({
      where: { email },
      include: {
        localAuthAccount: true,
        oauthAccounts: true,
      },
    });
  }

  async update(id: number, data: UpdateUserData): Promise<UserWithLocalAuthEntity> {
    return prisma.user.update({
      where: { id },
      data,
      include: {
        localAuthAccount: true,
      },
    });
  }

  async delete(id: number): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Check if an email is registered (excluding shadow users)
   */
  async isEmailRegistered(email: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        status: { not: UserStatus.INVITED }, // Exclude shadow users
      },
    });
    return !!user;
  }

  async createShadowUser(email: string): Promise<UserWithAuthEntity> {
    return prisma.user.create({
      data: {
        email,
        status: UserStatus.INVITED,
        dateInvited: new Date(),
      },
      include: {
        localAuthAccount: true,
        oauthAccounts: true,
      },
    });
  }

  async createUserWithWorkspaceAndSubscription(
    data: CreateUserWithWorkspaceAndSubscriptionData,
  ): Promise<UserEntity> {
    return prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          firstName: data.firstName,
          lastName: data.lastName,
          photoUrl: data.photoUrl,
          timezone: data.timezone,
          language: data.language,
          status: data.status as UserStatus,
          type: data.type as UserType,
          emailVerifiedAt: data.emailVerifiedAt,
          ...(data.passwordHash && {
            localAuthAccount: {
              create: {
                passwordHash: data.passwordHash,
              },
            },
          }),
        },
      });

      // Create verification request if provided (for local auth)
      if (data.verificationRequest) {
        await tx.verificationRequest.create({
          data: {
            userId: user.id,
            email: user.email,
            token: data.verificationRequest.token,
            type: data.verificationRequest.type,
            expiresAt: data.verificationRequest.expiresAt,
          },
        });
      }

      // Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: data.workspaceName,
          slug: data.slug,
          ownerId: user.id,
        },
      });

      // Add user as workspace owner
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceMemberRole.OWNER,
        },
      });

      // Create subscription
      await tx.subscription.create({
        data: {
          userId: user.id,
          planId: data.planId,
          status: data.subscriptionStatus,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePaymentMethodId: null,
          billingInterval: data.billingInterval,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      return user;
    });
  }

  async createOAuthUserWithWorkspaceAndSubscription(
    data: CreateOAuthUserWithWorkspaceAndSubscriptionData,
  ): Promise<UserEntity> {
    return prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          firstName: data.firstName,
          lastName: data.lastName,
          photoUrl: data.photoUrl,
          timezone: data.timezone,
          language: data.language,
          status: data.status as UserStatus,
          type: data.type as UserType,
          emailVerifiedAt: data.emailVerifiedAt,
        },
      });

      // Create OAuth account
      await tx.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: data.oauthProvider,
          providerUserId: data.oauthProviderUserId,
          accessToken: data.oauthAccessToken,
          refreshToken: data.oauthRefreshToken,
          expiresAt: data.oauthExpiresAt,
          metadata: data.oauthMetadata,
        },
      });

      // Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: data.workspaceName,
          slug: data.slug,
          ownerId: user.id,
        },
      });

      // Add user as workspace owner
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceMemberRole.OWNER,
        },
      });

      // Create subscription
      await tx.subscription.create({
        data: {
          userId: user.id,
          planId: data.planId,
          status: data.subscriptionStatus,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePaymentMethodId: null,
          billingInterval: data.billingInterval,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      return user;
    });
  }

  async activateShadowUserWithWorkspaceAndSubscription(
    userId: number,
    data: CreateUserWithWorkspaceAndSubscriptionData,
  ): Promise<UserEntity> {
    return prisma.$transaction(async (tx) => {
      // Update user
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          name: data.name,
          firstName: data.firstName,
          lastName: data.lastName,
          timezone: data.timezone,
          language: data.language,
          status: data.status as UserStatus,
          type: data.type as UserType,
          emailVerifiedAt: data.emailVerifiedAt,
          localAuthAccount: {
            create: {
              passwordHash: data.passwordHash!,
            },
          },
        },
      });

      // Create verification request if provided
      if (data.verificationRequest) {
        await tx.verificationRequest.create({
          data: {
            userId: user.id,
            email: user.email,
            token: data.verificationRequest.token,
            type: data.verificationRequest.type,
            expiresAt: data.verificationRequest.expiresAt,
          },
        });
      }

      // Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: data.workspaceName,
          slug: data.slug,
          ownerId: user.id,
        },
      });

      // Add user as workspace owner
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceMemberRole.OWNER,
        },
      });

      // Create subscription
      await tx.subscription.create({
        data: {
          userId: user.id,
          planId: data.planId,
          status: data.subscriptionStatus,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePaymentMethodId: null,
          billingInterval: data.billingInterval,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      return user;
    });
  }
}

