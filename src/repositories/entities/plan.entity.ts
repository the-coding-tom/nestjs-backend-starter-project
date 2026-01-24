import { PlanType } from '@prisma/client';

/**
 * Plan entity returned from database queries
 */
export interface PlanEntity {
  id: number;
  name: string;
  slug: string;
  displayName: string;
  description: string | null;
  planType: PlanType;
  apiAccess: boolean;
  prioritySupport: boolean;
  customDomain: boolean;
  advancedAnalytics: boolean;
  webhookSupport: boolean;
  teamCollaboration: boolean;
  maxSeats: number;
  maxTeamMembers: number;
  maxWorkspaces: number;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class CreatePlanData {
  name: string;
  slug: string;
  displayName: string;
  description?: string | null;
  planType: PlanType;
  apiAccess: boolean;
  prioritySupport: boolean;
  customDomain: boolean;
  advancedAnalytics: boolean;
  webhookSupport: boolean;
  teamCollaboration: boolean;
  maxSeats: number;
  maxTeamMembers: number;
  maxWorkspaces: number;
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  stripeMonthlyPriceId?: string | null;
  stripeYearlyPriceId?: string | null;
  isActive: boolean;
  displayOrder: number;
}

export class UpdatePlanData {
  displayName?: string;
  description?: string | null;
  apiAccess?: boolean;
  prioritySupport?: boolean;
  customDomain?: boolean;
  advancedAnalytics?: boolean;
  webhookSupport?: boolean;
  teamCollaboration?: boolean;
  maxSeats?: number;
  maxTeamMembers?: number;
  maxWorkspaces?: number;
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  stripeMonthlyPriceId?: string | null;
  stripeYearlyPriceId?: string | null;
  isActive?: boolean;
  displayOrder?: number;
}

