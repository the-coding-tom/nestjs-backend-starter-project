import { Injectable } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import prisma from '../common/prisma';
import { CreateOAuthAccountData, UpdateOAuthAccountData } from './entities/oauth-account.entity';

@Injectable()
export class OAuthAccountRepository {
  async findByProviderAndProviderUserId(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<any | null> {
    return prisma.oAuthAccount.findFirst({
      where: {
        provider,
        providerUserId,
      },
      include: {
        User: true,
      },
    });
  }

  async findByUserIdAndProvider(
    userId: number,
    provider: OAuthProvider,
  ): Promise<any | null> {
    return prisma.oAuthAccount.findFirst({
      where: {
        userId,
        provider,
      },
      include: {
        User: true,
      },
    });
  }

  async create(data: CreateOAuthAccountData): Promise<any> {
    return prisma.oAuthAccount.create({
      data,
    });
  }

  async update(id: number, data: UpdateOAuthAccountData): Promise<any> {
    return prisma.oAuthAccount.update({
      where: { id },
      data,
    });
  }

  async delete(id: number): Promise<void> {
    await prisma.oAuthAccount.delete({
      where: { id },
    });
  }
}

