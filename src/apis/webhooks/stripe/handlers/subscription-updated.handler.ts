import Stripe from 'stripe';
import { SubscriptionRepository } from '../../../../repositories/subscription.repository';
import { SubscriptionStatus } from '@prisma/client';
import {
  getSubscriptionPeriodBounds,
  retrieveSubscription,
} from '../../../../common/services/stripe/stripe.service';
import prisma from '../../../../common/prisma';

export async function handleSubscriptionUpdated(
  stripeSubscription: Stripe.Subscription,
  subscriptionRepository: SubscriptionRepository,
) {
  console.log(`[Stripe] Subscription updated: ${stripeSubscription.id}`);

  const subscription = await subscriptionRepository.findByStripeSubscriptionId(
    stripeSubscription.id,
  );

  if (!subscription) {
    console.warn('[Stripe] Subscription not found:', stripeSubscription.id);
    return;
  }

  let { currentPeriodStart, currentPeriodEnd } =
    getSubscriptionPeriodBounds(stripeSubscription);

  if (!currentPeriodStart || !currentPeriodEnd) {
    const expandedSubscription = await retrieveSubscription(
      stripeSubscription.id,
      { expand: ['items.data'] },
    );
    const bounds = getSubscriptionPeriodBounds(expandedSubscription);
    currentPeriodStart = currentPeriodStart ?? bounds.currentPeriodStart;
    currentPeriodEnd = currentPeriodEnd ?? bounds.currentPeriodEnd;
  }

  await prisma.$transaction(async (tx) => {
    // 1. Create history record (snapshot of current state)
    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
        billingInterval: subscription.billingInterval,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });

    // 2. Update subscription using transaction client
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: stripeSubscription.status.toUpperCase() as SubscriptionStatus,
        ...(currentPeriodStart ? { currentPeriodStart } : {}),
        ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      },
    });
  });

  console.log(`[Stripe] Subscription updated for ${subscription.id}`);
}

