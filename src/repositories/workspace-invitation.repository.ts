import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { WorkspaceMemberRole, InvitationStatus } from '@prisma/client';
import { CreateWorkspaceInvitationData } from './entities/workspace-invitation.entity';
import { WorkspaceMemberResponseEntity } from './entities/workspace-member.entity';

@Injectable()
export class WorkspaceInvitationRepository {
  async findByToken(token: string): Promise<any | null> {
    const result = await prisma.$queryRaw<Array<any>>`
      SELECT
        wi.id,
        wi.workspace_id as "workspaceId",
        wi.email,
        wi.token,
        wi.role,
        wi.inviter_id as "inviterId",
        wi.status::text as status,
        wi.accepted_at as "acceptedAt",
        wi.rejected_at as "rejectedAt",
        wi.expires_at as "expiresAt",
        wi.created_at as "createdAt",
        wi.updated_at as "updatedAt",
        w.name as "workspaceName",
        u.email as "inviterEmail",
        u.name as "inviterName"
      FROM workspace_invitations wi
      INNER JOIN workspaces w ON wi.workspace_id = w.id
      INNER JOIN users u ON wi.inviter_id = u.id
      WHERE wi.token = ${token}
      LIMIT 1
    `;

    return result[0] || null;
  }

  async findByWorkspaceAndEmail(workspaceId: number, email: string): Promise<any | null> {
    const result = await prisma.$queryRaw<Array<any>>`
      SELECT
        wi.id,
        wi.workspace_id as "workspaceId",
        wi.email,
        wi.token,
        wi.role,
        wi.inviter_id as "inviterId",
        wi.accepted_at as "acceptedAt",
        wi.expires_at as "expiresAt",
        wi.created_at as "createdAt",
        wi.updated_at as "updatedAt"
      FROM workspace_invitations wi
      WHERE wi.workspace_id = ${workspaceId}
        AND wi.email = ${email}
        AND wi.accepted_at IS NULL
        AND wi.expires_at > NOW()
      LIMIT 1
    `;

    return result[0] || null;
  }

  async create(data: CreateWorkspaceInvitationData): Promise<any> {
    return prisma.workspaceInvitation.create({
      data,
      select: {
        id: true,
        workspaceId: true,
        email: true,
        token: true,
        role: true,
        inviterId: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async markAsAccepted(token: string, acceptedAt: Date): Promise<void> {
    await prisma.workspaceInvitation.update({
      where: { token },
      data: { acceptedAt },
    });
  }

  async acceptInvitationAndCreateMember(
    workspaceId: number,
    userId: number,
    role: WorkspaceMemberRole,
    token: string,
    acceptedAt: Date,
  ): Promise<WorkspaceMemberResponseEntity> {
    return prisma.$transaction(async (tx) => {
      // Mark invitation as accepted
      await tx.workspaceInvitation.update({
        where: { token },
        data: {
          acceptedAt,
          status: InvitationStatus.ACCEPTED,
        },
      });

      // Create workspace member
      await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId,
          role,
        },
      });

      // Return clean member data for response using raw SQL
      const [member] = await tx.$queryRaw<WorkspaceMemberResponseEntity[]>`
        SELECT
          u.id as "userId",
          u.email,
          u.name,
          u.first_name as "firstName",
          u.last_name as "lastName",
          u.photo_url as "photoUrl",
          wm.role::text as role,
          wm.created_at as "createdAt"
        FROM workspace_members wm
        JOIN users u ON u.id = wm.user_id
        WHERE wm.workspace_id = ${workspaceId}
          AND wm.user_id = ${userId}
      `;

      return member!;
    });
  }

  async markAsRejected(token: string, rejectedAt: Date): Promise<void> {
    await prisma.workspaceInvitation.update({
      where: { token },
      data: {
        rejectedAt,
        status: InvitationStatus.REJECTED,
      },
    });
  }

  async deleteByToken(token: string): Promise<void> {
    await prisma.workspaceInvitation.delete({
      where: { token },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.workspaceInvitation.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        acceptedAt: null,
      },
    });
    return result.count;
  }

  async findByEmail(email: string): Promise<any[]> {
    const result = await prisma.$queryRaw<Array<any>>`
      SELECT
        wi.id,
        wi.workspace_id as "workspaceId",
        wi.email,
        wi.token,
        wi.role,
        wi.inviter_id as "inviterId",
        wi.accepted_at as "acceptedAt",
        wi.expires_at as "expiresAt",
        wi.created_at as "createdAt",
        wi.updated_at as "updatedAt",
        w.name as "workspaceName",
        w.image as "workspaceImage",
        u.name as "inviterName",
        u.email as "inviterEmail"
      FROM workspace_invitations wi
      INNER JOIN workspaces w ON wi.workspace_id = w.id
      INNER JOIN users u ON wi.inviter_id = u.id
      WHERE wi.email = ${email}
        AND wi.accepted_at IS NULL
        AND wi.expires_at > NOW()
      ORDER BY wi.created_at DESC
    `;

    return result;
  }

  async updateToken(id: number, token: string, expiresAt: Date): Promise<void> {
    await prisma.workspaceInvitation.update({
      where: { id },
      data: { token, expiresAt },
    });
  }
}

