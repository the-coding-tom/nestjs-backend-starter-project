export class GetPlansQueryDto {
  planType?: string;
  isActive?: boolean;
}

export class PlanResponseDto {
  id: number;
  name: string;
  slug: string;
  displayName: string;
  description: string | null;
  planType: string;
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
  isActive: boolean;
  displayOrder: number;
}

