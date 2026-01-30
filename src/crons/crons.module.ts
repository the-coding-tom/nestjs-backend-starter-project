import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RepositoriesModule } from '../repositories/repositories.module';
import { QueueProducersModule } from '../queues/queue-producers.module';
import { CleanupExpiredSessionsCron } from './processes/cleanup-expired-sessions.cron';
import { CleanupExpiredCheckoutSessionsCron } from './processes/cleanup-expired-checkout-sessions.cron';
import { SubscriptionReconciliationCron } from './processes/subscription-reconciliation.cron';
import { QueueCleanupCron } from './processes/queue-cleanup.cron';

/**
 * Crons Module
 *
 * Registers all scheduled tasks (cron jobs).
 * Add new cron jobs here as you create them.
 *
 * Usage:
 * 1. Create cron class in processes/ folder
 * 2. Register cron here
 * 3. Import required modules (RepositoriesModule, etc.)
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    RepositoriesModule,
    QueueProducersModule,
  ],
  providers: [
    CleanupExpiredSessionsCron,
    SubscriptionReconciliationCron,
    CleanupExpiredCheckoutSessionsCron,
    QueueCleanupCron,
  ],
})
export class CronsModule { }

