import Stripe from 'stripe';
import { SubscriptionRepository } from '../../../../repositories/subscription.repository';
import { SubscriptionStatus } from '@prisma/client';

/**
 * Marks subscription as PAST_DUE when an invoice payment fails so we can surface billing issues.
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  subscriptionRepository: SubscriptionRepository,
) {
  console.log(`[Stripe] Invoice payment failed: ${invoice.id}`);

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

  await subscriptionRepository.updateStatus(subscription.id, SubscriptionStatus.PAST_DUE);
  console.log(`[Stripe] Subscription marked as past_due: ${subscription.id}`);
}

