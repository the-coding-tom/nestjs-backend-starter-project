import { WorkspaceMemberRole } from '@prisma/client';

export class CreateWorkspaceInvitationData {
  workspaceId: number;
  email: string;
  token: string;
  role: WorkspaceMemberRole;
  inviterId: number;
  inviteeId: number;
  inviteCode?: number;
  expiresAt: Date;
  [key: string]: any;
}

