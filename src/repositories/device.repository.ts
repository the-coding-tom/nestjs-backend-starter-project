import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { CreateDeviceData, UpdateDeviceData } from './entities/device.entity';

@Injectable()
export class DeviceRepository {
  async create(data: CreateDeviceData): Promise<any> {
    return prisma.device.create({
      data: {
        userId: data.userId,
        fcmToken: data.fcmToken,
        platform: data.platform,
        enabled: data.enabled ?? true,
      },
    });
  }

  async findById(id: number): Promise<any | null> {
    return prisma.device.findUnique({
      where: { id },
    });
  }

  async findByToken(fcmToken: string): Promise<any | null> {
    return prisma.device.findUnique({
      where: { fcmToken },
    });
  }

  async findByUser(userId: number): Promise<any[]> {
    return prisma.device.findMany({
      where: {
        userId,
        enabled: true,
      },
    });
  }

  async updateByToken(fcmToken: string, data: UpdateDeviceData): Promise<any> {
    return prisma.device.update({
      where: { fcmToken },
      data: {
        fcmToken: data.fcmToken,
        platform: data.platform,
        enabled: data.enabled,
      },
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    await prisma.device.deleteMany({
      where: {
        id,
        userId,
      },
    });
  }

  async deleteByToken(fcmToken: string): Promise<void> {
    await prisma.device.delete({
      where: { fcmToken },
    });
  }

  async updateLastSeen(fcmToken: string): Promise<void> {
    await prisma.device.update({
      where: { fcmToken },
      data: {
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Mark device token as invalid (for FCM errors)
   */
  async markTokenInvalid(id: number): Promise<void> {
    await prisma.device.update({
      where: { id },
      data: {
        isInvalidToken: true,
        invalidTokenReportedAt: new Date(),
        enabled: false, // Disable device when token is invalid
      },
    });
  }

  /**
   * Update last delivery status and error
   */
  async updateDeliveryStatus(
    id: number,
    status: 'success' | 'failed',
    error?: string,
  ): Promise<void> {
    await prisma.device.update({
      where: { id },
      data: {
        lastDeliveryStatus: status,
        lastDeliveryError: error || null,
        lastDeliveryAttemptAt: new Date(),
      },
    });
  }

  /**
   * Find invalid tokens older than specified days
   */
  async findInvalidTokens(olderThanDays: number): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return prisma.device.findMany({
      where: {
        isInvalidToken: true,
        invalidTokenReportedAt: {
          lt: cutoffDate,
        },
      },
    });
  }

  /**
   * Delete invalid tokens by IDs
   */
  async deleteInvalidTokens(deviceIds: number[]): Promise<number> {
    const result = await prisma.device.deleteMany({
      where: {
        id: {
          in: deviceIds,
        },
        isInvalidToken: true,
      },
    });
    return result.count;
  }
}

