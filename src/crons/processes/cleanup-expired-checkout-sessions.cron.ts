import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StripeCheckoutSessionRepository } from '../../repositories/stripe-checkout-session.repository';

@Injectable()
export class CleanupExpiredCheckoutSessionsCron {
  private readonly logger = new Logger(CleanupExpiredCheckoutSessionsCron.name);

  private readonly EXPIRE_SESSION_HOURS = 48; // Sessions older than 48 hours are marked expired

  constructor(
    private readonly stripeCheckoutSessionRepository: StripeCheckoutSessionRepository,
  ) {}

  /**
   * Cleanup job - runs daily at midnight
   * Expires old PENDING checkout sessions that will never be completed
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpireOldSessions() {
    this.logger.log('[CLEANUP] Starting expired checkout session cleanup');

    try {
      const cutoffTime = new Date(Date.now() - this.EXPIRE_SESSION_HOURS * 60 * 60 * 1000);

      const expiredCount = await this.stripeCheckoutSessionRepository.expireOldPendingSessions(
        cutoffTime,
      );

      this.logger.log(`[CLEANUP] Marked ${expiredCount} old checkout sessions as EXPIRED`);
    } catch (error) {
      this.logger.error(
        `[CLEANUP] Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
