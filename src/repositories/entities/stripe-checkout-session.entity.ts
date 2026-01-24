import { BillingInterval, CheckoutSessionStatus } from '@prisma/client';

export class CreateStripeCheckoutSessionData {
  stripeSessionId: string;
  userId: number;
  planId: number;
  billingInterval: BillingInterval;
  status?: CheckoutSessionStatus;
}

export class UpdateStripeCheckoutSessionData {
  status?: CheckoutSessionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  errorMessage?: string | null;
  processedAt?: Date | null;
}
