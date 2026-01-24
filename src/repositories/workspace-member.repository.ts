import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { WorkspaceMemberRole } from '@prisma/client';
import { CreateWorkspaceMemberData, WorkspaceMemberResponseEntity } from './entities/workspace-member.entity';

@Injectable()
export class WorkspaceMemberRepository {
  async create(data: CreateWorkspaceMemberData): Promise<WorkspaceMemberResponseEntity> {
    return prisma.$transaction(async (tx) => {
      await tx.workspaceMember.create({
        data,
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
        WHERE wm.workspace_id = ${data.workspaceId}
          AND wm.user_id = ${data.userId}
      `;
      return member!;
    });
  }

  async findByWorkspaceId(workspaceId: number): Promise<any[]> {
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        User: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByUserId(userId: number): Promise<any[]> {
    return prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        Workspace: {
          include: {
            Owner: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByWorkspaceAndUser(workspaceId: number, userId: number): Promise<WorkspaceMemberResponseEntity | undefined> {
    const [member] = await prisma.$queryRaw<WorkspaceMemberResponseEntity[]>`
      SELECT 
        u.id as "userId",
        u.email,
        u.name,
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.photo_url as "photoUrl",
        CASE 
          WHEN w.owner_id = u.id THEN 'OWNER'::text
          ELSE wm.role::text
        END as role,
        COALESCE(wm.created_at, w.created_at) as "createdAt"
      FROM workspaces w
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ${userId}
      LEFT JOIN users u ON (w.owner_id = u.id OR wm.user_id = u.id)
      WHERE w.id = ${workspaceId}
        AND u.id = ${userId}
        AND (w.owner_id = u.id OR wm.user_id = u.id)
    `;
    return member;
  }

  async remove(workspaceId: number, userId: number): Promise<void> {
    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
  }

  async updateRole(workspaceId: number, userId: number, role: WorkspaceMemberRole): Promise<WorkspaceMemberResponseEntity> {
    return prisma.$transaction(async (tx) => {
      await tx.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
        data: { role },
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
          CASE 
            WHEN w.owner_id = u.id THEN 'OWNER'::text
            ELSE wm.role::text
          END as role,
          COALESCE(wm.created_at, w.created_at) as "createdAt"
        FROM workspaces w
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ${userId}
        LEFT JOIN users u ON (w.owner_id = u.id OR wm.user_id = u.id)
        WHERE w.id = ${workspaceId}
          AND u.id = ${userId}
          AND (w.owner_id = u.id OR wm.user_id = u.id)
      `;
      return member!;
    });
  }

  async countByWorkspaceId(workspaceId: number): Promise<number> {
    return prisma.workspaceMember.count({
      where: { workspaceId },
    });
  }

  async findAllByWorkspaceId(workspaceId: number): Promise<WorkspaceMemberResponseEntity[]> {
    return prisma.$queryRaw<WorkspaceMemberResponseEntity[]>`
      SELECT 
        u.id as "userId",
        u.email,
        u.name,
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.photo_url as "photoUrl",
        CASE 
          WHEN w.owner_id = u.id THEN 'OWNER'::text
          ELSE wm.role::text
        END as role,
        COALESCE(wm.created_at, w.created_at) as "createdAt"
      FROM workspaces w
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
      LEFT JOIN users u ON (w.owner_id = u.id OR wm.user_id = u.id)
      WHERE w.id = ${workspaceId}
        AND (w.owner_id = u.id OR wm.user_id = u.id)
      ORDER BY 
        CASE WHEN w.owner_id = u.id THEN 0 ELSE 1 END,
        COALESCE(wm.created_at, w.created_at) ASC
    `;
  }

}

