import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  EMAIL_NOTIFICATION_QUEUE,
  PUSH_NOTIFICATION_QUEUE,
  WHATSAPP_NOTIFICATION_QUEUE,
  STRIPE_CHECKOUT_QUEUE,
} from '../../common/constants/queues.constant';
import { config } from '../../config/config';

/**
 * Prevents Redis memory bloat from unconsumed or stalled Bull queue data.
 *
 * @remarks
 * - Hourly: removes old completed/failed jobs (Bull's removeOnComplete/removeOnFail can leave gaps under load).
 * - Every 6h: removes jobs stuck in “active” (e.g. worker died) so they don't sit in Redis forever.
 * - Every 10min: logs queue counts and Redis memory; triggers aggressive cleanup when usage exceeds threshold.
 */
@Injectable()
export class QueueCleanupCron {
  private readonly logger = new Logger(QueueCleanupCron.name);

  constructor(
    @InjectQueue(EMAIL_NOTIFICATION_QUEUE) private readonly emailQueue: Queue,
    @InjectQueue(PUSH_NOTIFICATION_QUEUE) private readonly pushQueue: Queue,
    @InjectQueue(WHATSAPP_NOTIFICATION_QUEUE) private readonly whatsappQueue: Queue,
    @InjectQueue(STRIPE_CHECKOUT_QUEUE) private readonly stripeCheckoutQueue: Queue,
  ) {}

  // Single list so adding a queue only requires updating queue-producers.module and this getter.
  private get allQueues(): Queue[] {
    return [
      this.emailQueue,
      this.pushQueue,
      this.whatsappQueue,
      this.stripeCheckoutQueue,
    ];
  }

  /**
   * Removes old completed/failed jobs so Redis does not retain them indefinitely under high load.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupCompletedAndFailed() {
    this.logger.log('Starting hourly queue cleanup (completed/failed)');

    try {
      for (const queue of this.allQueues) {
        const completedRemoved = await queue.clean(config.queueCleanup.completedCleanAgeMs, 'completed');
        const failedRemoved = await queue.clean(config.queueCleanup.failedCleanAgeMs, 'failed');

        if (completedRemoved.length > 0 || failedRemoved.length > 0) {
          this.logger.log(
            `Queue ${queue.name}: removed ${completedRemoved.length} completed, ${failedRemoved.length} failed jobs`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error during hourly queue cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Removes jobs stuck in "active" (e.g. worker died mid-job) so they are not left in Redis forever.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async cleanupStalledActive() {
    this.logger.log('Starting stalled active jobs cleanup');

    try {
      for (const queue of this.allQueues) {
        const activeJobs = await queue.getJobs(['active'], 0, -1);
        let removed = 0;

        for (const job of activeJobs) {
          const age = Date.now() - job.timestamp;
          if (age > config.queueCleanup.stuckActiveAgeMs) {
            await job.remove();
            removed += 1;
            this.logger.warn(
              `Removed stuck job ${job.id} from ${queue.name} (age: ${Math.round(age / 60000)} min)`,
            );
          }
        }

        if (removed > 0) {
          this.logger.log(`Queue ${queue.name}: removed ${removed} stuck active jobs`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error during stalled jobs cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Logs queue counts and Redis memory for visibility; triggers aggressive cleanup when usage is critical.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async monitorQueuesAndRedis() {
    try {
      for (const queue of this.allQueues) {
        const counts = await queue.getJobCounts();
        const total =
          (counts.waiting ?? 0) +
          (counts.active ?? 0) +
          (counts.completed ?? 0) +
          (counts.failed ?? 0) +
          (counts.delayed ?? 0);

        if (total > 10000) {
          this.logger.warn(`Queue ${queue.name} has high job count: ${total}`, counts as object);
        }
      }

      await this.checkRedisMemory();
    } catch (error) {
      this.logger.error(
        `Error during queue/Redis monitoring: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Bull uses one Redis connection per queue; any queue's client is the same Redis for INFO memory.
  private async checkRedisMemory() {
    try {
      const redis = this.emailQueue.client;
      const info = await redis.info('memory');
      const lines = info.split(/\r?\n/);

      let usedBytes = 0;
      let maxBytes = 0;

      for (const line of lines) {
        if (line.startsWith('used_memory:')) {
          usedBytes = parseInt(line.slice('used_memory:'.length), 10);
        }
        if (line.startsWith('maxmemory:')) {
          maxBytes = parseInt(line.slice('maxmemory:'.length), 10);
        }
      }

      if (maxBytes <= 0) {
        const usedMB = Math.round(usedBytes / 1024 / 1024);
        this.logger.log(`Redis memory: ${usedMB} MB (maxmemory not set)`);
        return;
      }

      const percent = (usedBytes / maxBytes) * 100;
      const usedMB = Math.round(usedBytes / 1024 / 1024);
      const maxMB = Math.round(maxBytes / 1024 / 1024);

      if (percent >= config.queueCleanup.redisMemoryCriticalPercent) {
        this.logger.error(`Redis memory critical: ${usedMB} MB / ${maxMB} MB (${percent.toFixed(1)}%)`);
        await this.aggressiveCleanup();
      } else if (percent >= config.queueCleanup.redisMemoryWarnPercent) {
        this.logger.warn(`Redis memory warning: ${usedMB} MB / ${maxMB} MB (${percent.toFixed(1)}%)`);
      } else {
        this.logger.log(`Redis memory: ${usedMB} MB / ${maxMB} MB (${percent.toFixed(1)}%)`);
      }
    } catch (error) {
      this.logger.error(
        `Error checking Redis memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Shorter retention than config.queueCleanup so we reclaim memory quickly when usage is critical.
  private async aggressiveCleanup() {
    this.logger.warn('Running aggressive queue cleanup due to high Redis memory');

    const completedAgeMs = 10 * 60 * 1000;
    const failedAgeMs = 60 * 60 * 1000;
    const activeAgeMs = 30 * 60 * 1000;

    for (const queue of this.allQueues) {
      try {
        await queue.clean(completedAgeMs, 'completed');
        await queue.clean(failedAgeMs, 'failed');
        await queue.clean(activeAgeMs, 'active');
        this.logger.log(`Aggressive cleanup completed for ${queue.name}`);
      } catch (error) {
        this.logger.error(
          `Aggressive cleanup failed for ${queue.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }
}
