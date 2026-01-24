import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { SubscriptionStatus } from '@prisma/client';
import {
  CreateSubscriptionData,
  UpdateSubscriptionData,
  SubscriptionWithPlanEntity,
  SubscriptionWithPlanAndUserEntity,
  SubscriptionHistoryWithPlanEntity,
} from './entities/subscription.entity';

@Injectable()
export class SubscriptionRepository {
  async create(data: CreateSubscriptionData): Promise<SubscriptionWithPlanEntity> {
    return prisma.subscription.create({
      data,
      include: {
        Plan: true,
      },
    }) as unknown as SubscriptionWithPlanEntity;
  }

  async update(id: number, data: UpdateSubscriptionData): Promise<SubscriptionWithPlanEntity> {
    return prisma.subscription.update({
      where: { id },
      data,
      include: {
        Plan: true,
      },
    }) as unknown as SubscriptionWithPlanEntity;
  }

  async findByUserId(userId: number): Promise<SubscriptionWithPlanEntity | null> {
    const result = await prisma.subscription.findFirst({
      where: { userId },
      include: {
        Plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return result as unknown as SubscriptionWithPlanEntity | null;
  }

  async findActiveByUserId(userId: number): Promise<SubscriptionWithPlanEntity | null> {
    const result = await prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
      include: {
        Plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return result as unknown as SubscriptionWithPlanEntity | null;
  }

  async findHistoryBySubscriptionId(subscriptionId: number): Promise<SubscriptionHistoryWithPlanEntity[]> {
    const results = await prisma.subscriptionHistory.findMany({
      where: { subscriptionId },
      include: {
        Plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return results as unknown as SubscriptionHistoryWithPlanEntity[];
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<SubscriptionWithPlanAndUserEntity | null> {
    const result = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
      include: {
        Plan: true,
        User: true,
      },
    });
    return result as unknown as SubscriptionWithPlanAndUserEntity | null;
  }

  async updateStatus(id: number, status: SubscriptionStatus): Promise<SubscriptionWithPlanEntity> {
    return prisma.subscription.update({
      where: { id },
      data: { status },
      include: {
        Plan: true,
      },
    }) as unknown as SubscriptionWithPlanEntity;
  }

  /**
   * Get workspace owner's active subscription with plan details
   */
  async findWorkspaceOwnerActiveSubscription(workspaceId: number): Promise<SubscriptionWithPlanEntity | null> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        Owner: {
          include: {
            subscriptions: {
              where: {
                status: {
                  in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
                },
              },
              include: {
                Plan: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!workspace) {
      return null;
    }

    return (workspace.Owner.subscriptions[0] as unknown as SubscriptionWithPlanEntity) || null;
  }
}

