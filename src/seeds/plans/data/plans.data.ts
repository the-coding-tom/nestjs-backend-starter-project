import { PlanType } from '@prisma/client';

export const plansData = [
  // Free Plan
  {
    name: 'free',
    slug: 'free',
    displayName: 'Free',
    description: 'Perfect for getting started with basic features',
    planType: PlanType.FREE,
    apiAccess: true,
    prioritySupport: false,
    customDomain: false,
    advancedAnalytics: false,
    webhookSupport: false,
    teamCollaboration: false,
    maxSeats: 1, // Owner only, no team members
    maxTeamMembers: 0,
    maxWorkspaces: 1,
    monthlyPrice: 0,
    yearlyPrice: 0,
    isActive: true,
    displayOrder: 1,
  },
  // Pro Plan
  {
    name: 'pro',
    slug: 'pro',
    displayName: 'Pro',
    description: 'Best for growing teams with advanced features',
    planType: PlanType.PAID,
    apiAccess: true,
    prioritySupport: true,
    customDomain: true,
    advancedAnalytics: true,
    webhookSupport: true,
    teamCollaboration: true,
    maxSeats: 5, // Owner + 4 team members
    maxTeamMembers: 4,
    maxWorkspaces: 5,
    monthlyPrice: 29.99,
    yearlyPrice: 299.99, // ~17% discount
    isActive: true,
    displayOrder: 2,
  },
];

