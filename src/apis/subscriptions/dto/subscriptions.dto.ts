export class CreateCheckoutSessionDto {
  planSlug: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  successUrl: string;
  cancelUrl: string;
}

export class ChangePlanDto {
  planSlug: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
}

export class SubscriptionResponseDto {
  id: number;
  userId: number;
  planId: number;
  status: string;
  billingInterval: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null; // null for free plans (never expires)
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  plan: {
    id: number;
    name: string;
    slug: string;
    displayName: string;
    planType: string;
    maxSeats: number;
    maxTeamMembers: number;
  };
}

