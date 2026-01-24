import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { CheckoutSessionStatus } from '@prisma/client';
import {
  CreateStripeCheckoutSessionData,
  UpdateStripeCheckoutSessionData,
} from './entities/stripe-checkout-session.entity';

@Injectable()
export class StripeCheckoutSessionRepository {
  async create(data: CreateStripeCheckoutSessionData): Promise<any> {
    return prisma.stripeCheckoutSession.create({
      data: {
        stripeSessionId: data.stripeSessionId,
        userId: data.userId,
        planId: data.planId,
        billingInterval: data.billingInterval,
        status: data.status ?? CheckoutSessionStatus.PENDING,
      },
    });
  }

  async findByStripeSessionId(stripeSessionId: string): Promise<any | null> {
    return prisma.stripeCheckoutSession.findUnique({
      where: { stripeSessionId },
      include: {
        User: true,
        Plan: true,
      },
    });
  }

  async update(id: number, data: UpdateStripeCheckoutSessionData): Promise<any> {
    return prisma.stripeCheckoutSession.update({
      where: { id },
      data,
    });
  }

  async updateByStripeSessionId(
    stripeSessionId: string,
    data: UpdateStripeCheckoutSessionData,
  ): Promise<any> {
    return prisma.stripeCheckoutSession.update({
      where: { stripeSessionId },
      data,
    });
  }

  /**
   * Find stale PENDING sessions for reconciliation
   */
  async findStalePendingSessions(createdBefore: Date): Promise<any[]> {
    return prisma.stripeCheckoutSession.findMany({
      where: {
        status: CheckoutSessionStatus.PENDING,
        createdAt: {
          lt: createdBefore,
        },
      },
      include: {
        User: true,
        Plan: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Mark old PENDING sessions as EXPIRED
   */
  async expireOldPendingSessions(createdBefore: Date): Promise<number> {
    const result = await prisma.stripeCheckoutSession.updateMany({
      where: {
        status: CheckoutSessionStatus.PENDING,
        createdAt: {
          lt: createdBefore,
        },
      },
      data: {
        status: CheckoutSessionStatus.EXPIRED,
      },
    });

    return result.count;
  }
}
