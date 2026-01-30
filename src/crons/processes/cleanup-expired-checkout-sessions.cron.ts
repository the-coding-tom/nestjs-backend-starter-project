import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StripeCheckoutSessionRepository } from '../../repositories/stripe-checkout-session.repository';

/**
 * Marks old PENDING checkout sessions as EXPIRED so the DB and Stripe expectations stay in sync when users never complete checkout.
 */
@Injectable()
export class CleanupExpiredCheckoutSessionsCron {
  private readonly logger = new Logger(CleanupExpiredCheckoutSessionsCron.name);

  // Stripe checkout links typically expire within 24h; 48h gives buffer before we mark PENDING as EXPIRED.
  private readonly EXPIRE_SESSION_HOURS = 48;

  constructor(
    private readonly stripeCheckoutSessionRepository: StripeCheckoutSessionRepository,
  ) {}

  /**
   * Expires PENDING checkout sessions that will never be completed so they are not left in PENDING forever.
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
