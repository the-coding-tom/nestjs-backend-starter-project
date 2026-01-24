import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';

@Injectable()
export class BackupCodeRepository {
  async createBackupCodes(userId: number, hashedCodes: string[]): Promise<any[]> {
    await prisma.mfaBackupCode.createMany({
      data: hashedCodes.map(code => ({
        userId,
        code,
        used: false,
      })),
    });

    return this.findByUserId(userId);
  }

  async findByUserId(userId: number): Promise<any[]> {
    return prisma.mfaBackupCode.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async markAsUsed(id: number): Promise<void> {
    await prisma.mfaBackupCode.update({
      where: { id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });
  }

  async deleteByUserId(userId: number): Promise<void> {
    await prisma.mfaBackupCode.deleteMany({
      where: { userId },
    });
  }
}

