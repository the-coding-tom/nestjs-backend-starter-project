import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { STRIPE_CHECKOUT_QUEUE } from '../../common/constants/queues.constant';
import { StripeCheckoutSessionRepository } from '../../repositories/stripe-checkout-session.repository';
import { PlanRepository } from '../../repositories/plan.repository';
import { CheckoutSessionStatus, SubscriptionStatus } from '@prisma/client';
import {
  retrieveSubscription,
  getSubscriptionPeriodBounds,
} from '../../common/services/stripe/stripe.service';
import prisma from '../../common/prisma';

export interface StripeCheckoutJobData {
  stripeSessionId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  source: 'webhook' | 'reconciliation';
}

/**
 * Stripe Checkout Processor
 *
 * Processes checkout session completions from both webhooks and reconciliation cron.
 * Implements idempotency by checking session status before processing.
 */
@Processor(STRIPE_CHECKOUT_QUEUE)
export class StripeCheckoutProcessor implements OnModuleInit {
  private readonly logger = new Logger(StripeCheckoutProcessor.name);

  constructor(
    @InjectQueue(STRIPE_CHECKOUT_QUEUE) private readonly queue: Queue,
    private readonly stripeCheckoutSessionRepository: StripeCheckoutSessionRepository,
    private readonly planRepository: PlanRepository,
  ) {
    this.logger.log(`[INIT] StripeCheckoutProcessor initialized for queue: ${STRIPE_CHECKOUT_QUEUE}`);
  }

  onModuleInit() {
    this.logger.log(`[INIT] Setting up queue event listeners for ${STRIPE_CHECKOUT_QUEUE}`);

    this.queue.on('error', (error) => {
      this.logger.error(`[QUEUE ERROR] ${error.message}`, error.stack);
    });

    this.queue.on('active', (job: Job) => {
      this.logger.log(`[EVENT: ACTIVE] Job ${job.id} is now active - Session: ${job.data.stripeSessionId}`);
    });

    this.queue.on('completed', (job: Job) => {
      this.logger.log(`[EVENT: COMPLETED] Job ${job.id} completed - Session: ${job.data.stripeSessionId}`);
    });

    this.queue.on('failed', (job: Job | undefined, error: Error) => {
      this.logger.error(
        `[EVENT: FAILED] Job ${job?.id || 'unknown'} failed: ${error.message}`,
        error.stack,
      );
    });

    this.queue.on('stalled', (jobId: string | number) => {
      this.logger.warn(`[EVENT: STALLED] Job ${jobId} stalled`);
    });

    this.logger.log(`[INIT] Queue event listeners registered for ${STRIPE_CHECKOUT_QUEUE}`);
  }

  @Process()
  async handleCheckoutSession(job: Job<StripeCheckoutJobData>) {
    const { stripeSessionId, stripeCustomerId, stripeSubscriptionId, source } = job.data;

    this.logger.log(
      `[PROCESS START] Processing checkout session ${stripeSessionId} (source: ${source}, Job ID: ${job.id})`,
    );

    try {
      // 1. Fetch session from database
      const checkoutSession = await this.stripeCheckoutSessionRepository.findByStripeSessionId(stripeSessionId);

      if (!checkoutSession) {
        this.logger.warn(`[PROCESS] Checkout session ${stripeSessionId} not found in database`);
        return { status: 'not_found', stripeSessionId };
      }

      // 2. IDEMPOTENCY CHECK: If already completed, return early
      if (checkoutSession.status === CheckoutSessionStatus.COMPLETED) {
        this.logger.log(
          `[PROCESS] Checkout session ${stripeSessionId} already COMPLETED - skipping (idempotent)`,
        );
        return { status: 'already_completed', stripeSessionId };
      }

      // 3. If status is EXPIRED or FAILED, skip processing
      if (checkoutSession.status === CheckoutSessionStatus.EXPIRED) {
        this.logger.log(`[PROCESS] Checkout session ${stripeSessionId} is EXPIRED - skipping`);
        return { status: 'expired', stripeSessionId };
      }

      if (checkoutSession.status === CheckoutSessionStatus.FAILED) {
        this.logger.log(`[PROCESS] Checkout session ${stripeSessionId} is FAILED - skipping`);
        return { status: 'failed', stripeSessionId };
      }

      // 4. Validate required Stripe IDs
      const customerId = stripeCustomerId || checkoutSession.stripeCustomerId;
      const subscriptionId = stripeSubscriptionId || checkoutSession.stripeSubscriptionId;

      if (!subscriptionId) {
        this.logger.error(`[PROCESS] No Stripe subscription ID for session ${stripeSessionId}`);
        await this.stripeCheckoutSessionRepository.update(checkoutSession.id, {
          status: CheckoutSessionStatus.FAILED,
          errorMessage: 'No Stripe subscription ID available',
        });
        return { status: 'error', error: 'No subscription ID' };
      }

      if (!customerId) {
        this.logger.error(`[PROCESS] No Stripe customer ID for session ${stripeSessionId}`);
        await this.stripeCheckoutSessionRepository.update(checkoutSession.id, {
          status: CheckoutSessionStatus.FAILED,
          errorMessage: 'No Stripe customer ID available',
        });
        return { status: 'error', error: 'No customer ID' };
      }

      // 5. Retrieve subscription from Stripe to get period bounds
      const stripeSubscription = await retrieveSubscription(subscriptionId, {
        expand: ['items.data'],
      });

      const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriodBounds(stripeSubscription);

      // 6. Get plan from database
      const plan = await this.planRepository.findById(checkoutSession.planId);
      if (!plan) {
        this.logger.error(`[PROCESS] Plan ${checkoutSession.planId} not found`);
        await this.stripeCheckoutSessionRepository.update(checkoutSession.id, {
          status: CheckoutSessionStatus.FAILED,
          errorMessage: `Plan ${checkoutSession.planId} not found`,
        });
        return { status: 'error', error: 'Plan not found' };
      }

      const userId = checkoutSession.userId;

      // 7. Process subscription in transaction
      await prisma.$transaction(async (tx) => {
        // Check if subscription with this Stripe ID already exists
        let subscription = await tx.subscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
          include: { Plan: true },
        });

        // If not found by Stripe ID, check for active subscription for user
        if (!subscription) {
          subscription = await tx.subscription.findFirst({
            where: {
              userId,
              status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
            },
            include: { Plan: true },
          });
        }

        if (!subscription) {
          // Create new subscription
          await tx.subscription.create({
            data: {
              userId,
              planId: plan.id,
              status: SubscriptionStatus.ACTIVE,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              billingInterval: checkoutSession.billingInterval,
              currentPeriodStart: currentPeriodStart || new Date(),
              currentPeriodEnd: currentPeriodEnd || null,
              cancelAtPeriodEnd: false,
            },
          });
          this.logger.log(`[PROCESS] Created new subscription for user ${userId}`);
        } else {
          // Create history record before updating
          await tx.subscriptionHistory.create({
            data: {
              subscriptionId: subscription.id,
              planId: subscription.planId,
              status: subscription.status,
              billingInterval: subscription.billingInterval,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd || new Date(),
            },
          });

          // Update existing subscription
          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              planId: plan.id,
              status: SubscriptionStatus.ACTIVE,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              billingInterval: checkoutSession.billingInterval,
              ...(currentPeriodStart ? { currentPeriodStart } : {}),
              ...(currentPeriodEnd ? { currentPeriodEnd } : {}),
              cancelAtPeriodEnd: false,
              canceledAt: null,
            },
          });
          this.logger.log(`[PROCESS] Updated subscription with history for user ${userId}`);
        }

        // Mark checkout session as COMPLETED
        await tx.stripeCheckoutSession.update({
          where: { id: checkoutSession.id },
          data: {
            status: CheckoutSessionStatus.COMPLETED,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            processedAt: new Date(),
          },
        });
      });

      this.logger.log(
        `[PROCESS SUCCESS] Successfully processed checkout session ${stripeSessionId} for user ${userId}`,
      );

      return { status: 'completed', stripeSessionId, userId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `[PROCESS ERROR] Failed to process checkout session ${stripeSessionId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Update session with error (if we can)
      try {
        await this.stripeCheckoutSessionRepository.updateByStripeSessionId(stripeSessionId, {
          errorMessage,
        });
      } catch {
        // Ignore error updating session
      }

      throw error; // Will trigger Bull retry
    }
  }
}
