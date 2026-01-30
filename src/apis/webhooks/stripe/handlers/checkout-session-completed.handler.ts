import Stripe from 'stripe';
import { SubscriptionRepository } from '../../../../repositories/subscription.repository';
import { PlanRepository } from '../../../../repositories/plan.repository';
import { SubscriptionStatus, BillingInterval } from '@prisma/client';
import {
  getSubscriptionPeriodBounds,
  retrieveSubscription,
} from '../../../../common/services/stripe/stripe.service';
import { CreateSubscriptionData, SubscriptionWithPlanEntity } from '../../../../repositories/entities/subscription.entity';
import prisma from '../../../../common/prisma';

/**
 * After Stripe checkout completes: creates or updates subscription from session metadata, with history for plan changes.
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  subscriptionRepository: SubscriptionRepository,
  planRepository: PlanRepository,
) {
  console.log(`[Stripe] Checkout session completed: ${session.id}`);

  const metadata = (session.metadata ?? {}) as Stripe.Metadata;
  const userIdValue = metadata.userId;
  const planSlug = metadata.planSlug;
  const billingInterval = metadata.billingInterval;

  if (!userIdValue) {
    console.error('[Stripe] No userId provided in checkout session metadata');
    return;
  }

  if (!planSlug) {
    console.error('[Stripe] No planSlug provided in checkout session metadata');
    return;
  }

  const userId = parseInt(userIdValue, 10);

  if (Number.isNaN(userId)) {
    console.error('[Stripe] Invalid userId in checkout session metadata:', userIdValue);
    return;
  }

  const stripeSubscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  if (!stripeSubscriptionId) {
    console.error('[Stripe] No subscription ID found on checkout session');
    return;
  }

  const stripeCustomerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

  if (!stripeCustomerId) {
    console.error('[Stripe] No customer ID found on checkout session');
    return;
  }

  const stripeSubscription = await retrieveSubscription(stripeSubscriptionId, {
    expand: ['items.data'],
  });

  const { currentPeriodStart, currentPeriodEnd } =
    getSubscriptionPeriodBounds(stripeSubscription);

  const plan = await planRepository.findBySlug(planSlug);
  if (!plan) {
    console.error('[Stripe] Plan not found:', planSlug);
    return;
  }

  // Step 1: Check if this exact Stripe subscription already exists (idempotency)
  let subscription: SubscriptionWithPlanEntity | null = await subscriptionRepository.findByStripeSubscriptionId(stripeSubscriptionId);

  // Step 2: If not found, check if user has any existing active subscription (handles free-to-paid)
  if (!subscription) {
    subscription = await subscriptionRepository.findActiveByUserId(userId);
  }

  const newBillingInterval = billingInterval === 'YEARLY' ? BillingInterval.YEARLY : BillingInterval.MONTHLY;

  if (!subscription) {
    const subscriptionData: CreateSubscriptionData = {
      userId,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      stripeCustomerId,
      stripeSubscriptionId,
      billingInterval: newBillingInterval,
      currentPeriodStart: currentPeriodStart || new Date(),
      currentPeriodEnd: currentPeriodEnd || new Date(),
      cancelAtPeriodEnd: false,
    };

    subscription = await subscriptionRepository.create(subscriptionData);
    console.log(`[Stripe] Subscription created for user ${userId}`);
  } else {
    // Update existing subscription with transaction to create history
    await prisma.$transaction(async (tx) => {
      // 1. Create history record (snapshot of current state BEFORE update)
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          planId: subscription.planId,
          status: subscription.status,
          billingInterval: subscription.billingInterval,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd || new Date(),
        },
      });

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          stripeCustomerId,
          stripeSubscriptionId,
          billingInterval: newBillingInterval,
          ...(currentPeriodStart ? { currentPeriodStart } : {}),
          ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });
    });
    console.log(`[Stripe] Subscription updated with history for user ${userId}`);
  }

  console.log(`[Stripe] Subscription activated for user ${userId}`);
}
