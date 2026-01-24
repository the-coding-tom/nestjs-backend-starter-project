import { WorkspaceMemberRole } from '@prisma/client';

export class CreateWorkspaceDto {
  name: string;
}

export class UpdateWorkspaceDto {
  name?: string;
  image?: string | null;
}

export class InviteWorkspaceMemberDto {
  email: string;
  role?: WorkspaceMemberRole;
}

export class UpdateWorkspaceMemberRoleDto {
  role: WorkspaceMemberRole;
}

export class ResendWorkspaceInvitationDto {
  email: string;
}

export class PreviewInvitationDto {
  token: string;
}

export class RejectInvitationDto {
  token: string;
}

