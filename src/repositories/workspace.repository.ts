import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { WorkspaceMemberRole } from '@prisma/client';
import { CreateWorkspaceData, UpdateWorkspaceData, WorkspaceResponseEntity, WorkspaceListItemEntity } from './entities/workspace.entity';

@Injectable()
export class WorkspaceRepository {
  async create(data: CreateWorkspaceData): Promise<any> {
    return prisma.workspace.create({
      data,
      include: {
        Owner: true,
        members: {
          include: {
            User: true,
          },
        },
      },
    });
  }

  async createWithOwnerMember(
    workspaceData: CreateWorkspaceData,
    ownerId: number,
  ): Promise<WorkspaceResponseEntity> {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: workspaceData,
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: ownerId,
          role: WorkspaceMemberRole.OWNER,
        },
      });

      return workspace;
    });
  }

  async findById(id: number): Promise<WorkspaceResponseEntity | undefined> {
    const [workspace] = await prisma.$queryRaw<WorkspaceResponseEntity[]>`
      SELECT 
        w.id,
        w.name,
        w.slug,
        w.image,
        w.owner_id as "ownerId",
        w.created_at as "createdAt",
        w.updated_at as "updatedAt"
      FROM workspaces w
      WHERE w.id = ${id}
    `;
    return workspace;
  }

  async findByOwnerId(ownerId: number): Promise<any[]> {
    return prisma.workspace.findMany({
      where: { ownerId },
      include: {
        members: {
          include: {
            User: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlugAndOwner(ownerId: number, slug: string): Promise<any | null> {
    return prisma.workspace.findFirst({
      where: {
        ownerId,
        slug,
      },
      include: {
        Owner: true,
        members: {
          include: {
            User: true,
          },
        },
      },
    });
  }

  async update(id: number, data: UpdateWorkspaceData): Promise<WorkspaceResponseEntity> {
    return prisma.workspace.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async delete(id: number): Promise<void> {
    await prisma.workspace.delete({
      where: { id },
    });
  }

  async countByOwnerId(ownerId: number): Promise<number> {
    return prisma.workspace.count({
      where: { ownerId },
    });
  }

  async getMaxSlugNumber(ownerId: number, baseSlug: string): Promise<number> {
    const result = await prisma.$queryRaw<Array<{ max_number: number }>>`
      SELECT COALESCE(MAX(
        CASE 
          WHEN slug = ${baseSlug} THEN 0
          WHEN slug ~ ('^' || ${baseSlug} || '-(\\d+)$') THEN 
            CAST(SUBSTRING(slug FROM LENGTH(${baseSlug}) + 2) AS INTEGER)
          ELSE NULL
        END
      ), 0) as max_number
      FROM workspaces
      WHERE owner_id = ${ownerId} AND slug LIKE ${baseSlug} || '%'
    `;
    return result[0]?.max_number ?? 0;
  }

  async findAllByUserId(userId: number): Promise<WorkspaceListItemEntity[]> {
    return prisma.$queryRaw<WorkspaceListItemEntity[]>`
      SELECT 
        w.id,
        w.name,
        w.slug,
        w.image,
        w.created_at as "createdAt",
        w.updated_at as "updatedAt",
        CASE 
          WHEN w.owner_id = ${userId} THEN 'OWNER'::text
          ELSE wm.role::text
        END as role
      FROM workspaces w
      LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = ${userId}
      WHERE w.owner_id = ${userId} OR wm.user_id = ${userId}
      ORDER BY w.created_at DESC
    `;
  }

}

