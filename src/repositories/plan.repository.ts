import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { PlanType } from '@prisma/client';
import { CreatePlanData, UpdatePlanData } from './entities/plan.entity';

@Injectable()
export class PlanRepository {
  async findAll(filters?: { planType?: PlanType; isActive?: boolean }): Promise<any[]> {
    return prisma.plan.findMany({
      where: filters,
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findBySlug(slug: string): Promise<any | null> {
    return prisma.plan.findUnique({
      where: { slug },
    });
  }

  async findById(id: number): Promise<any | null> {
    return prisma.plan.findUnique({
      where: { id },
    });
  }

  async create(data: CreatePlanData): Promise<any> {
    return prisma.plan.create({
      data,
    });
  }

  async update(id: number, data: UpdatePlanData): Promise<any> {
    return prisma.plan.update({
      where: { id },
      data,
    });
  }

  async getMaxSlugNumber(baseSlug: string): Promise<number> {
    const result = await prisma.$queryRaw<Array<{ max_number: number }>>`
      SELECT COALESCE(MAX(
        CASE 
          WHEN slug = ${baseSlug} THEN 0
          WHEN slug ~ ('^' || ${baseSlug} || '-(\\d+)$') THEN 
            CAST(SUBSTRING(slug FROM LENGTH(${baseSlug}) + 2) AS INTEGER)
          ELSE NULL
        END
      ), 0) as max_number
      FROM plans
      WHERE slug LIKE ${baseSlug} || '%'
    `;
    return result[0]?.max_number ?? 0;
  }

  async findFreePlan(): Promise<any | null> {
    return prisma.plan.findFirst({
      where: {
        planType: PlanType.FREE,
        isActive: true,
      },
    });
  }
}

