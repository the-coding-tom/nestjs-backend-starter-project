import { WorkspaceMemberRole } from '@prisma/client';

export class CreateWorkspaceMemberData {
  workspaceId: number;
  userId: number;
  role: WorkspaceMemberRole;
  [key: string]: any;
}

export class UpdateWorkspaceMemberData {
  role?: WorkspaceMemberRole;
  [key: string]: any;
}

export class WorkspaceMemberResponseEntity {
  userId: number;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  role: string;
  createdAt: Date;
}

