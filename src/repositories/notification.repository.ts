import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { CreateNotificationData, UpdateNotificationData } from './entities/notification.entity';

@Injectable()
export class NotificationRepository {
  async create(data: CreateNotificationData): Promise<any> {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        category: data.category,
        title: data.title,
        body: data.body,
        type: data.type,
        payload: data.payload,
      },
    });
  }

  async findById(id: number): Promise<any | null> {
    return prisma.notification.findUnique({
      where: { id },
    });
  }

  async findByUser(
    userId: number,
    options?: { limit?: number; offset?: number; unreadOnly?: boolean; category?: any },
  ): Promise<any[]> {
    const where: any = { userId };
    if (options?.unreadOnly) {
      where.readAt = null;
    }
    if (options?.category) {
      where.category = options.category;
    }

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  async countByUser(userId: number, unreadOnly?: boolean, category?: any): Promise<number> {
    const where: any = { userId };
    if (unreadOnly) {
      where.readAt = null;
    }
    if (category) {
      where.category = category;
    }

    return prisma.notification.count({ where });
  }

  async update(id: number, data: UpdateNotificationData): Promise<any> {
    return prisma.notification.update({
      where: { id },
      data: {
        readAt: data.readAt,
      },
    });
  }

  async markAllAsRead(userId: number): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    await prisma.notification.deleteMany({
      where: {
        id,
        userId,
      },
    });
  }
}

