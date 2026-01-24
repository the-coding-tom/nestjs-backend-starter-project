import { WorkspaceMemberRole, Workspace } from '@prisma/client';
import { WorkspaceMemberResponseEntity } from '../repositories/entities/workspace-member.entity';

/**
 * Check if user is the workspace owner
 */
export function isWorkspaceOwner(workspace: Workspace, userId: number): boolean {
  return workspace.ownerId === userId;
}

/**
 * Check if user has manager role
 */
export function isWorkspaceManager(membership: WorkspaceMemberResponseEntity | undefined): boolean {
  return membership?.role === WorkspaceMemberRole.MANAGER;
}

/**
 * Check if user can manage team (invite/remove members)
 * Only Owner and Manager can manage team
 */
export function canManageTeam(
  workspace: Workspace,
  userId: number,
  membership: WorkspaceMemberResponseEntity | undefined,
): boolean {
  const isOwner = isWorkspaceOwner(workspace, userId);
  const isManager = isWorkspaceManager(membership);
  return isOwner || isManager;
}

/**
 * Check if user can manage checks (create/edit/delete monitors)
 * Owner, Manager, and Member can manage checks
 * Read-only cannot manage checks
 */
export function canManageChecks(
  workspace: Workspace,
  userId: number,
  membership: WorkspaceMemberResponseEntity | undefined,
): boolean {
  const isOwner = isWorkspaceOwner(workspace, userId);
  
  if (isOwner) return true;
  
  if (!membership) return false;
  
  return (
    membership.role === WorkspaceMemberRole.MANAGER ||
    membership.role === WorkspaceMemberRole.MEMBER
  );
}

/**
 * Check if user can view workspace
 * Any member (including read-only) can view
 */
export function canView(
  workspace: Workspace,
  userId: number,
  membership: WorkspaceMemberResponseEntity | undefined,
): boolean {
  const isOwner = isWorkspaceOwner(workspace, userId);
  return isOwner || membership !== undefined;
}
