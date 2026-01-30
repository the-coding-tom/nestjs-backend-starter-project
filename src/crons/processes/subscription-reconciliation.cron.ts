import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { StripeCheckoutSessionRepository } from '../../repositories/stripe-checkout-session.repository';
import { STRIPE_CHECKOUT_QUEUE } from '../../common/constants/queues.constant';
import { StripeCheckoutJobData } from '../../queues/processors/stripe-checkout.processor';
import { retrieveCheckoutSession } from '../../common/services/stripe/stripe.service';

/**
 * Safety net when Stripe webhooks are missed: verifies PENDING checkout sessions with Stripe and queues paid ones for processing.
 *
 * @remarks Webhooks handle most completions; this cron catches sessions that never received a webhook.
 */
@Injectable()
export class SubscriptionReconciliationCron {
  private readonly logger = new Logger(SubscriptionReconciliationCron.name);

  // Webhooks usually complete within minutes; 1h avoids re-checking too soon while catching missed webhooks.
  private readonly STALE_SESSION_HOURS = 1;

  constructor(
    private readonly stripeCheckoutSessionRepository: StripeCheckoutSessionRepository,
    @InjectQueue(STRIPE_CHECKOUT_QUEUE) private readonly stripeCheckoutQueue: Queue,
  ) {}

  /**
   * Finds PENDING sessions older than threshold, verifies with Stripe, and queues paid sessions for processing so subscriptions are not stuck.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleReconciliation() {
    this.logger.log('[RECONCILIATION] Starting subscription reconciliation');

    try {
      const cutoffTime = new Date(Date.now() - this.STALE_SESSION_HOURS * 60 * 60 * 1000);

      const staleSessions = await this.stripeCheckoutSessionRepository.findStalePendingSessions(
        cutoffTime,
      );

      this.logger.log(`[RECONCILIATION] Found ${staleSessions.length} stale PENDING sessions`);

      let queuedCount = 0;
      let paidCount = 0;
      let notPaidCount = 0;
      let errorCount = 0;

      for (const session of staleSessions) {
        try {
          const stripeSession = await retrieveCheckoutSession(session.stripeSessionId);

          if (!stripeSession) {
            this.logger.warn(
              `[RECONCILIATION] Session ${session.stripeSessionId} not found in Stripe`,
            );
            continue;
          }

          if (stripeSession.payment_status === 'paid') {
            paidCount++;

            const stripeSubscriptionId =
              typeof stripeSession.subscription === 'string'
                ? stripeSession.subscription
                : stripeSession.subscription?.id;

            const stripeCustomerId =
              typeof stripeSession.customer === 'string'
                ? stripeSession.customer
                : stripeSession.customer?.id;

            const jobData: StripeCheckoutJobData = {
              stripeSessionId: session.stripeSessionId,
              stripeCustomerId: stripeCustomerId || undefined,
              stripeSubscriptionId: stripeSubscriptionId || undefined,
              source: 'reconciliation',
            };

            await this.stripeCheckoutQueue.add(jobData, {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
              removeOnComplete: true,
              removeOnFail: false,
            });

            queuedCount++;
            this.logger.log(
              `[RECONCILIATION] Queued paid session ${session.stripeSessionId} for processing`,
            );
          } else {
            notPaidCount++;
            this.logger.debug(
              `[RECONCILIATION] Session ${session.stripeSessionId} payment_status: ${stripeSession.payment_status}`,
            );
          }
        } catch (error) {
          errorCount++;
          this.logger.error(
            `[RECONCILIATION] Error checking session ${session.stripeSessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      this.logger.log(
        `[RECONCILIATION] Completed - Queued: ${queuedCount}, Paid: ${paidCount}, Not Paid: ${notPaidCount}, Errors: ${errorCount}`,
      );
    } catch (error) {
      this.logger.error(
        `[RECONCILIATION] Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
