import Stripe from 'stripe';
import { SubscriptionRepository } from '../../../../repositories/subscription.repository';
import { SubscriptionStatus } from '@prisma/client';

/**
 * Marks our subscription as CANCELED when Stripe subscription is deleted.
 */
export async function handleSubscriptionDeleted(
  stripeSubscription: Stripe.Subscription,
  subscriptionRepository: SubscriptionRepository,
) {
  console.log(`[Stripe] Subscription deleted: ${stripeSubscription.id}`);

  const subscription = await subscriptionRepository.findByStripeSubscriptionId(
    stripeSubscription.id,
  );

  if (!subscription) {
    console.warn('[Stripe] Subscription not found:', stripeSubscription.id);
    return;
  }

  await subscriptionRepository.update(subscription.id, {
    status: SubscriptionStatus.CANCELED,
    canceledAt: new Date(),
    cancelAtPeriodEnd: false,
  });

  console.log(`[Stripe] Subscription canceled for ${subscription.id}`);
}

