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

interface RedisMemoryInfo {
  usedMemoryBytes: number;
  maxMemoryBytes: number;
  usagePercent: number;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

const BYTES_PER_MB = 1024 * 1024;
const MS_PER_MINUTE = 60 * 1000;

/**
 * Queue Cleanup Cron
 *
 * Prevents Redis memory growth by cleaning up old Bull queue jobs.
 *
 * Scheduled tasks:
 * - Every hour: Remove old completed and failed jobs
 * - Every 6 hours: Move stuck active jobs to failed (e.g. worker died)
 * - Every 10 minutes: Log Redis memory and queue health
 *
 * When Redis memory exceeds the critical threshold (config), aggressive
 * cleanup runs with shorter retention to reclaim memory quickly.
 */
@Injectable()
export class QueueCleanupCron {
  private readonly logger = new Logger(QueueCleanupCron.name);
  private readonly queues: Queue[] = [];

  private isHourlyCleanupRunning = false;
  private isStuckJobsCleanupRunning = false;
  private isMonitoringRunning = false;

  constructor(
    @InjectQueue(EMAIL_NOTIFICATION_QUEUE) emailQueue: Queue,
    @InjectQueue(PUSH_NOTIFICATION_QUEUE) pushQueue: Queue,
    @InjectQueue(WHATSAPP_NOTIFICATION_QUEUE) whatsappQueue: Queue,
    @InjectQueue(STRIPE_CHECKOUT_QUEUE) stripeCheckoutQueue: Queue,
  ) {
    this.queues = [emailQueue, pushQueue, whatsappQueue, stripeCheckoutQueue];
    this.logger.log(`Initialized with ${this.queues.length} queues`);
  }

  /**
   * Hourly: Remove old completed and failed jobs from all queues.
   * Uses aggressive cleanup (shorter retention) when Redis memory exceeds threshold.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyCleanup() {
    if (this.isHourlyCleanupRunning) {
      this.logger.debug('Skipping: previous hourly cleanup still running');
      return;
    }

    this.isHourlyCleanupRunning = true;

    try {
      const memory = await this.getRedisMemoryInfo();
      const useAggressiveMode =
        memory.usagePercent >= config.queueCleanup.redisMemoryCriticalPercent;

      if (useAggressiveMode) {
        this.logger.warn(
          `Redis at ${memory.usagePercent.toFixed(1)}% - using aggressive cleanup`,
        );
      }

      const stats = await this.cleanAllQueues(useAggressiveMode);

      if (stats.completedRemoved > 0 || stats.failedRemoved > 0) {
        this.logger.log(
          `Cleanup done: ${stats.completedRemoved} completed, ${stats.failedRemoved} failed jobs removed`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Hourly cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isHourlyCleanupRunning = false;
    }
  }

  /**
   * Every 6 hours: Find jobs stuck in "active" too long and move them to failed.
   * These are typically orphaned after a worker crash.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleStuckJobsCleanup() {
    if (this.isStuckJobsCleanupRunning) {
      this.logger.debug('Skipping: previous stuck jobs cleanup still running');
      return;
    }

    this.isStuckJobsCleanupRunning = true;

    try {
      let totalRemoved = 0;

      for (const queue of this.queues) {
        totalRemoved += await this.failStuckActiveJobs(queue);
      }

      if (totalRemoved > 0) {
        this.logger.log(`Stuck jobs cleanup: moved ${totalRemoved} jobs to failed`);
      }
    } catch (error) {
      this.logger.error(
        `Stuck jobs cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isStuckJobsCleanupRunning = false;
    }
  }

  /**
   * Every 10 minutes: Log Redis memory and queue stats.
   * Triggers hourly cleanup when memory exceeds critical threshold.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleMonitoring() {
    if (this.isMonitoringRunning) {
      return;
    }

    this.isMonitoringRunning = true;

    try {
      const memory = await this.getRedisMemoryInfo();
      const stats = await this.getAggregatedQueueStats();

      this.logger.log(`Redis: ${this.formatMemoryInfo(memory)}`);
      this.logger.log(
        `Queues: ${stats.waiting} waiting, ${stats.active} active, ${stats.completed} completed, ${stats.failed} failed, ${stats.delayed} delayed`,
      );

      if (memory.usagePercent >= config.queueCleanup.redisMemoryCriticalPercent) {
        this.logger.warn('Memory threshold exceeded - triggering cleanup');
        if (!this.isHourlyCleanupRunning) {
          await this.handleHourlyCleanup();
        }
      } else if (memory.usagePercent >= config.queueCleanup.redisMemoryWarnPercent) {
        this.logger.warn(`Redis memory warning: ${memory.usagePercent.toFixed(1)}%`);
      }
    } catch (error) {
      this.logger.error(
        `Monitoring failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isMonitoringRunning = false;
    }
  }

  /**
   * Clean completed and failed jobs from all queues.
   * When aggressive is true, uses shorter retention to reclaim memory quickly.
   */
  private async cleanAllQueues(
    aggressive: boolean,
  ): Promise<{ completedRemoved: number; failedRemoved: number }> {
    const completedGraceMs = aggressive
      ? 10 * MS_PER_MINUTE
      : config.queueCleanup.completedCleanAgeMs;
    const failedGraceMs = aggressive
      ? 60 * MS_PER_MINUTE
      : config.queueCleanup.failedCleanAgeMs;

    let totalCompleted = 0;
    let totalFailed = 0;

    for (const queue of this.queues) {
      try {
        const completed = await queue.clean(completedGraceMs, 'completed');
        const failed = await queue.clean(failedGraceMs, 'failed');
        totalCompleted += completed.length;
        totalFailed += failed.length;
      } catch (error) {
        this.logger.error(
          `Failed to clean queue ${queue.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (aggressive) {
      for (const queue of this.queues) {
        try {
          await queue.clean(30 * MS_PER_MINUTE, 'active');
        } catch (error) {
          this.logger.error(
            `Failed to clean active jobs in ${queue.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return { completedRemoved: totalCompleted, failedRemoved: totalFailed };
  }

  /**
   * Move jobs stuck in "active" longer than configured age to failed.
   */
  private async failStuckActiveJobs(queue: Queue): Promise<number> {
    let count = 0;

    try {
      const activeJobs = await queue.getActive();
      const now = Date.now();
      const maxAgeMs = config.queueCleanup.stuckActiveAgeMs;

      for (const job of activeJobs) {
        const jobAge = now - (job.processedOn ?? job.timestamp);

        if (jobAge > maxAgeMs) {
          const ageMinutes = Math.round(jobAge / MS_PER_MINUTE);
          this.logger.warn(
            `Failing stuck job ${job.id} in ${queue.name} (${ageMinutes} min old)`,
          );
          await job.moveToFailed(
            { message: 'Job stuck in active state too long' },
            true,
          );
          count += 1;
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to check stuck jobs in ${queue.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return count;
  }

  private async getRedisMemoryInfo(): Promise<RedisMemoryInfo> {
    try {
      const client = this.queues[0].client;
      const info = await client.info('memory');

      const usedMatch = info.match(/used_memory:(\d+)/);
      const maxMatch = info.match(/maxmemory:(\d+)/);

      const usedMemoryBytes = usedMatch ? parseInt(usedMatch[1], 10) : 0;
      const maxMemoryBytes = maxMatch ? parseInt(maxMatch[1], 10) : 0;
      const usagePercent =
        maxMemoryBytes > 0 ? (usedMemoryBytes / maxMemoryBytes) * 100 : 0;

      return { usedMemoryBytes, maxMemoryBytes, usagePercent };
    } catch (error) {
      this.logger.error(
        `Failed to get Redis memory info: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { usedMemoryBytes: 0, maxMemoryBytes: 0, usagePercent: 0 };
    }
  }

  private async getAggregatedQueueStats(): Promise<QueueStats> {
    const totals: QueueStats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    };

    for (const queue of this.queues) {
      try {
        const counts = await queue.getJobCounts();
        totals.waiting += counts.waiting ?? 0;
        totals.active += counts.active ?? 0;
        totals.completed += counts.completed ?? 0;
        totals.failed += counts.failed ?? 0;
        totals.delayed += counts.delayed ?? 0;
      } catch (error) {
        this.logger.error(
          `Failed to get counts for ${queue.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return totals;
  }

  private formatMemoryInfo(info: RedisMemoryInfo): string {
    const usedMB = (info.usedMemoryBytes / BYTES_PER_MB).toFixed(1);

    if (info.maxMemoryBytes > 0) {
      const maxMB = (info.maxMemoryBytes / BYTES_PER_MB).toFixed(1);
      return `${usedMB} MB / ${maxMB} MB (${info.usagePercent.toFixed(1)}%)`;
    }

    return `${usedMB} MB (no limit)`;
  }
}
