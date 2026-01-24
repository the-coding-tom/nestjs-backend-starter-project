import { Injectable } from '@nestjs/common';
import prisma from '../common/prisma';
import { CreateWebhookEventLogData, WebhookEventLogEntity } from './entities/webhook-event-log.entity';

@Injectable()
export class WebhookEventLogRepository {
  async create(data: CreateWebhookEventLogData): Promise<WebhookEventLogEntity> {
    return prisma.webhookEventLog.create({
      data: {
        source: data.source,
        event: data.event,
        externalEventId: data.externalEventId,
        referenceId: data.referenceId,
        payload: data.payload,
      },
    });
  }

  async findBySourceAndReferenceId(source: string, referenceId: string): Promise<WebhookEventLogEntity[]> {
    return prisma.webhookEventLog.findMany({
      where: { source, referenceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async exists(source: string, referenceId: string, event: string): Promise<boolean> {
    const count = await prisma.webhookEventLog.count({
      where: { source, referenceId, event },
    });
    return count > 0;
  }
}
