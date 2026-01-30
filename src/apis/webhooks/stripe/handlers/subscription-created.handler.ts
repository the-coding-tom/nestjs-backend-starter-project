import Stripe from 'stripe';
import { SubscriptionRepository } from '../../../../repositories/subscription.repository';
import { SubscriptionStatus } from '@prisma/client';
import {
  getSubscriptionPeriodBounds,
  retrieveSubscription,
} from '../../../../common/services/stripe/stripe.service';

/**
 * Syncs period bounds from Stripe subscription.created to our subscription record.
 */
export async function handleSubscriptionCreated(
  stripeSubscription: Stripe.Subscription,
  subscriptionRepository: SubscriptionRepository,
) {
  console.log(`[Stripe] Subscription created: ${stripeSubscription.id}`);

  const subscription = await subscriptionRepository.findByStripeSubscriptionId(
    stripeSubscription.id,
  );

  if (!subscription) {
    console.warn(
      '[Stripe] Subscription not found in database:',
      stripeSubscription.id,
    );
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

  await subscriptionRepository.update(subscription.id, {
    status: stripeSubscription.status.toUpperCase() as SubscriptionStatus,
    ...(currentPeriodStart ? { currentPeriodStart } : {}),
    ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
  });
}

