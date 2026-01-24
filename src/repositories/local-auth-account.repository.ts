import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';

@Injectable()
export class LocalAuthAccountRepository {
  async findByUserId(userId: number): Promise<any | null> {
    return prisma.localAuthAccount.findUnique({
      where: { userId },
      include: {
        User: true,
      },
    });
  }

  async updatePassword(userId: number, passwordHash: string): Promise<any> {
    return prisma.localAuthAccount.update({
      where: { userId },
      data: { passwordHash },
    });
  }

  async create(userId: number, passwordHash: string): Promise<any> {
    return prisma.localAuthAccount.create({
      data: {
        userId,
        passwordHash,
      },
    });
  }

  async delete(userId: number): Promise<void> {
    await prisma.localAuthAccount.delete({
      where: { userId },
    });
  }
}

