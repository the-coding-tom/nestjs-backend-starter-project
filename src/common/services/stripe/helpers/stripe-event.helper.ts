import Stripe from 'stripe';

/**
 * Extract the most relevant reference ID from a Stripe event
 * Returns subscription ID, or customer ID as fallback
 */
export function extractStripeReferenceId(event: Stripe.Event): string | undefined {
  const obj = event.data.object as Record<string, any>;

  // Try to extract the most relevant reference ID based on event type
  if (obj.subscription) {
    // For checkout sessions and invoices, use subscription ID
    return typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id;
  }

  if (obj.id && event.type.startsWith('customer.subscription')) {
    // For subscription events, the object itself is the subscription
    return obj.id;
  }

  if (obj.customer) {
    // Fall back to customer ID
    return typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
  }

  return undefined;
}
