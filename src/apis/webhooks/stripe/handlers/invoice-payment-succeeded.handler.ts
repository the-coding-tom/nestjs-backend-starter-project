import Stripe from 'stripe';
import { SubscriptionRepository } from '../../../../repositories/subscription.repository';
import { SubscriptionStatus } from '@prisma/client';

/**
 * Reactivates subscription to ACTIVE when an invoice is paid (e.g. after past_due).
 */
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  subscriptionRepository: SubscriptionRepository,
) {
  console.log(`[Stripe] Invoice payment succeeded: ${invoice.id}`);

  const inv: any = invoice as any;
  const stripeSubscriptionId: string | undefined =
    typeof inv.subscription === 'string'
      ? inv.subscription
      : inv.subscription?.id;

  if (!stripeSubscriptionId) {
    console.warn('[Stripe] No subscription ID found on invoice');
    return;
  }

  const subscription = await subscriptionRepository.findByStripeSubscriptionId(
    stripeSubscriptionId,
  );

  if (!subscription) {
    console.warn('[Stripe] Subscription not found for invoice:', stripeSubscriptionId);
    return;
  }

  if (subscription.status !== SubscriptionStatus.ACTIVE) {
    await subscriptionRepository.updateStatus(subscription.id, SubscriptionStatus.ACTIVE);
    console.log(`[Stripe] Subscription reactivated after payment: ${subscription.id}`);
  }
}

