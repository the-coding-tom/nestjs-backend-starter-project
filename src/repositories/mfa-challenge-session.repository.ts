import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { CreateMfaChallengeSessionData, UpdateMfaChallengeSessionData } from './entities/mfa-session.entity';

@Injectable()
export class MfaChallengeSessionRepository {
  async create(data: CreateMfaChallengeSessionData): Promise<any> {
    return prisma.mfaChallengeSession.create({
      data,
    });
  }

  async update(id: number, data: UpdateMfaChallengeSessionData): Promise<any> {
    return prisma.mfaChallengeSession.update({
      where: { id },
      data,
    });
  }

  async findMfaSessionByToken(sessionToken: string): Promise<any | null> {
    return prisma.mfaChallengeSession.findFirst({
      where: {
        sessionToken,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  async markExpiredSessionsAsExpired(): Promise<void> {
    await prisma.$queryRaw`
      UPDATE mfa_challenge_sessions
      SET status = 'expired'::"MfaChallengeSessionStatus"
      WHERE 
        expires_at < NOW()
        AND status::"MfaChallengeSessionStatus" != 'expired'::"MfaChallengeSessionStatus"
    `;
  }
}

