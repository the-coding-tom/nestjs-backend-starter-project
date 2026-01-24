/**
 * Plan Features Helper
 *
 * Pure functions for extracting and working with plan features and limits.
 * These functions take plan data as input and return structured feature/limit objects.
 */

// Internal types - only used within this helper
interface PlanFeatures {
  apiAccess: boolean;
  prioritySupport: boolean;
  customDomain: boolean;
  advancedAnalytics: boolean;
  webhookSupport: boolean;
  teamCollaboration: boolean;
}

interface PlanLimits {
  maxSeats: number;
  maxTeamMembers: number;
  maxWorkspaces: number;
}

interface PlanWithFeaturesAndLimits {
  plan: unknown;
  features: PlanFeatures;
  limits: PlanLimits;
}

/**
 * Extract features from a plan object
 */
export function extractPlanFeatures(plan: unknown): PlanFeatures {
  const p = plan as Record<string, boolean>;
  return {
    apiAccess: p.apiAccess,
    prioritySupport: p.prioritySupport,
    customDomain: p.customDomain,
    advancedAnalytics: p.advancedAnalytics,
    webhookSupport: p.webhookSupport,
    teamCollaboration: p.teamCollaboration,
  };
}

/**
 * Extract limits from a plan object
 */
export function extractPlanLimits(plan: unknown): PlanLimits {
  const p = plan as Record<string, number>;
  return {
    maxSeats: p.maxSeats,
    maxTeamMembers: p.maxTeamMembers,
    maxWorkspaces: p.maxWorkspaces,
  };
}

/**
 * Build complete plan features and limits structure from a subscription or fallback plan
 * @param subscription - Active subscription with Plan included (or null)
 * @param fallbackPlan - Plan to use if no subscription (e.g., free plan)
 */
export function buildPlanFeaturesAndLimits(
  subscription: { Plan: unknown } | null,
  fallbackPlan: unknown,
): PlanWithFeaturesAndLimits {
  const plan = subscription?.Plan || fallbackPlan;

  if (!plan) {
    throw new Error('No plan available');
  }

  return {
    plan,
    features: extractPlanFeatures(plan),
    limits: extractPlanLimits(plan),
  };
}

/**
 * Check if a specific feature is enabled in plan features
 */
export function hasFeature(features: PlanFeatures, feature: keyof PlanFeatures): boolean {
  return features[feature] || false;
}
