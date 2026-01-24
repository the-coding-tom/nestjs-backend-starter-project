import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { VerificationRequestType } from '@prisma/client';
import { CreateVerificationRequestData } from './entities/verification-request.entity';

@Injectable()
export class VerificationRequestRepository {
  async findByToken(token: string): Promise<any | null> {
    return prisma.verificationRequest.findUnique({
      where: {
        token,
      },
      include: {
        User: true,
      },
    });
  }

  async create(data: CreateVerificationRequestData): Promise<any> {
    return prisma.verificationRequest.create({
      data,
    });
  }

  async deleteByToken(token: string): Promise<void> {
    await prisma.verificationRequest.deleteMany({
      where: { token },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.verificationRequest.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }

  async deleteByUserIdAndType(
    userId: number,
    type: VerificationRequestType,
  ): Promise<void> {
    await prisma.verificationRequest.deleteMany({
      where: {
        userId,
        type,
      },
    });
  }
}

