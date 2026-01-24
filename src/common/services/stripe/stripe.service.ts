import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { getStripe } from './helpers/stripe-client.helper';

export interface CreateCheckoutSessionParams {
  customerEmail: string;
  stripePriceId: string;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: Stripe.Event;
  error?: string;
}

export interface SubscriptionPeriodBounds {
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

/**
 * Stripe Service
 *
 * Handles all Stripe API operations including checkout sessions,
 * subscriptions, customer portal, and webhook verification.
 */
@Injectable()
export class StripeService {
  /**
   * Create Stripe checkout session for subscription
   */
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      customer_email: params.customerEmail,
      line_items: [
        {
          price: params.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    };

    if (params.metadata) {
      sessionParams.metadata = params.metadata;
    }

    if (params.trialDays && params.trialDays > 0) {
      sessionParams.subscription_data = {
        trial_period_days: params.trialDays,
      };
    }

    return getStripe().checkout.sessions.create(sessionParams);
  }

  /**
   * Create Stripe customer portal session
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  /**
   * Update Stripe subscription
   */
  async updateSubscription(
    subscriptionId: string,
    params: Stripe.SubscriptionUpdateParams,
  ): Promise<Stripe.Subscription> {
    return getStripe().subscriptions.update(subscriptionId, params);
  }

  /**
   * Cancel Stripe subscription at period end.
   * Turns off auto-renewal but keeps subscription active until expiration.
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return getStripe().subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  /**
   * Change subscription plan with dynamic proration
   * @param subscriptionId - Stripe subscription ID
   * @param newPriceId - New Stripe price ID
   * @param isUpgrade - Whether this is an upgrade (true) or downgrade (false)
   */
  async changePlan(
    subscriptionId: string,
    newPriceId: string,
    isUpgrade: boolean,
  ): Promise<Stripe.Subscription> {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    const subscriptionItemId = subscription.items.data[0].id;

    // Upgrade: give immediate credit (prorate)
    // Downgrade: no credit given (no proration)
    const prorationBehavior = isUpgrade ? 'create_prorations' : 'none';

    return getStripe().subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
        },
      ],
      proration_behavior: prorationBehavior,
    });
  }

  /**
   * List invoices for a customer
   */
  async listInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    const invoices = await getStripe().invoices.list({
      customer: customerId,
      limit,
    });
    return invoices.data;
  }

  /**
   * Verify Stripe webhook signature
   * Returns result object instead of throwing exceptions
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string,
  ): WebhookVerificationResult {
    try {
      const event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
      return { isValid: true, event };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown signature verification error',
      };
    }
  }

  /**
   * Retrieve Stripe checkout session
   */
  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
    try {
      return await getStripe().checkout.sessions.retrieve(sessionId);
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === 'resource_missing') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Retrieve Stripe subscription
   */
  async retrieveSubscription(
    subscriptionId: string,
    params?: Stripe.SubscriptionRetrieveParams,
  ): Promise<Stripe.Subscription> {
    return getStripe().subscriptions.retrieve(subscriptionId, params);
  }

  /**
   * Retrieve Stripe customer
   */
  async retrieveCustomer(customerId: string): Promise<Stripe.Customer> {
    return getStripe().customers.retrieve(customerId) as Promise<Stripe.Customer>;
  }

  /**
   * Get subscription period bounds from Stripe subscription.
   * Requires subscription to be retrieved with `expand: ['items.data']`.
   */
  getSubscriptionPeriodBounds(subscription: Stripe.Subscription): SubscriptionPeriodBounds {
    const item = subscription.items?.data?.[0];
    if (!item) {
      return {};
    }

    return {
      currentPeriodStart: item.current_period_start
        ? new Date(item.current_period_start * 1000)
        : undefined,
      currentPeriodEnd: item.current_period_end
        ? new Date(item.current_period_end * 1000)
        : undefined,
    };
  }
}

// Create singleton instance for backward compatibility functions
const stripeServiceInstance = new StripeService();

// Export standalone functions for backward compatibility during migration
// These can be removed once all callers are updated to use DI
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams,
): Promise<Stripe.Checkout.Session> {
  return stripeServiceInstance.createCheckoutSession(params);
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<Stripe.BillingPortal.Session> {
  return stripeServiceInstance.createPortalSession(customerId, returnUrl);
}

export async function updateSubscription(
  subscriptionId: string,
  params: Stripe.SubscriptionUpdateParams,
): Promise<Stripe.Subscription> {
  return stripeServiceInstance.updateSubscription(subscriptionId, params);
}

export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripeServiceInstance.cancelSubscription(subscriptionId);
}

export async function changePlan(
  subscriptionId: string,
  newPriceId: string,
  isUpgrade: boolean,
): Promise<Stripe.Subscription> {
  return stripeServiceInstance.changePlan(subscriptionId, newPriceId, isUpgrade);
}

export async function listInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
  return stripeServiceInstance.listInvoices(customerId, limit);
}

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string,
): WebhookVerificationResult {
  return stripeServiceInstance.verifyWebhookSignature(payload, signature, webhookSecret);
}

export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session | null> {
  return stripeServiceInstance.retrieveCheckoutSession(sessionId);
}

export async function retrieveSubscription(
  subscriptionId: string,
  params?: Stripe.SubscriptionRetrieveParams,
): Promise<Stripe.Subscription> {
  return stripeServiceInstance.retrieveSubscription(subscriptionId, params);
}

export async function retrieveCustomer(customerId: string): Promise<Stripe.Customer> {
  return stripeServiceInstance.retrieveCustomer(customerId);
}

export function getSubscriptionPeriodBounds(subscription: Stripe.Subscription): SubscriptionPeriodBounds {
  return stripeServiceInstance.getSubscriptionPeriodBounds(subscription);
}
