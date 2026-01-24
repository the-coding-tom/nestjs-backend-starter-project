import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import {
  EMAIL_NOTIFICATION_QUEUE,
  PUSH_NOTIFICATION_QUEUE,
  WHATSAPP_NOTIFICATION_QUEUE,
  STRIPE_CHECKOUT_QUEUE,
} from '../common/constants/queues.constant';

/**
 * Queue Producers Module
 * 
 * Registers all queues that can be used to enqueue jobs.
 * Add new queues here as you create them.
 * 
 * Usage:
 * 1. Add queue name to queues.constant.ts
 * 2. Register queue here
 * 3. Create processor in queue-processors.module.ts
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: EMAIL_NOTIFICATION_QUEUE },
      { name: PUSH_NOTIFICATION_QUEUE },
      { name: WHATSAPP_NOTIFICATION_QUEUE },
      { name: STRIPE_CHECKOUT_QUEUE },
    ),
  ],
  exports: [
    BullModule.registerQueue(
      { name: EMAIL_NOTIFICATION_QUEUE },
      { name: PUSH_NOTIFICATION_QUEUE },
      { name: WHATSAPP_NOTIFICATION_QUEUE },
      { name: STRIPE_CHECKOUT_QUEUE },
    ),
  ],
})
export class QueueProducersModule { }

