import { SubscriptionStatus, BillingInterval } from '@prisma/client';
import { PlanEntity } from './plan.entity';
import { UserEntity } from './user.entity';

export class CreateSubscriptionData {
  userId: number;
  planId: number;
  status: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePaymentMethodId?: string | null;
  billingInterval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null; // null for free plans (never expires)
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date | null;
  trialStart?: Date | null;
  trialEnd?: Date | null;
}

export class UpdateSubscriptionData {
  planId?: number;
  status?: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePaymentMethodId?: string | null;
  billingInterval?: BillingInterval;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  trialStart?: Date | null;
  trialEnd?: Date | null;
}

/**
 * Subscription entity with Plan included
 */
export interface SubscriptionWithPlanEntity {
  id: number;
  userId: number;
  planId: number;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePaymentMethodId: string | null;
  billingInterval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
  Plan: PlanEntity;
}

/**
 * Subscription entity with Plan and User included
 */
export interface SubscriptionWithPlanAndUserEntity extends SubscriptionWithPlanEntity {
  User: UserEntity;
}

/**
 * Subscription history entity with Plan included
 */
export interface SubscriptionHistoryWithPlanEntity {
  id: number;
  subscriptionId: number;
  planId: number;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  createdAt: Date;
  Plan: PlanEntity;
}

