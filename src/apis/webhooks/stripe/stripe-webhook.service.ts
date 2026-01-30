import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { I18nService } from 'nestjs-i18n';
import Stripe from 'stripe';
import { generateSuccessResponse, generateErrorResponse } from '../../../helpers/response.helper';
import { LoggerService } from '../../../common/services/logger/logger.service';
import { extractStripeReferenceId } from '../../../common/services/stripe/helpers/stripe-event.helper';
import { StripeEventType, WebhookSource } from '../../../common/enums/generic.enum';
import { translate } from '../../../helpers/i18n.helper';
import { STRIPE_CHECKOUT_QUEUE } from '../../../common/constants/queues.constant';
import { StripeCheckoutJobData } from '../../../queues/processors/stripe-checkout.processor';
import { SubscriptionRepository } from '../../../repositories/subscription.repository';
import { WebhookEventLogRepository } from '../../../repositories/webhook-event-log.repository';
import { StripeWebhookValidator } from './stripe-webhook.validator';
import { handleSubscriptionCreated } from './handlers/subscription-created.handler';
import { handleSubscriptionUpdated } from './handlers/subscription-updated.handler';
import { handleSubscriptionDeleted } from './handlers/subscription-deleted.handler';
import { handleInvoicePaymentSucceeded } from './handlers/invoice-payment-succeeded.handler';
import { handleInvoicePaymentFailed } from './handlers/invoice-payment-failed.handler';

/**
 * Receives Stripe webhooks, verifies signature, logs events, and routes to handlers or queue for checkout session processing.
 */
@Injectable()
export class StripeWebhookService {
  constructor(
    private readonly i18n: I18nService,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly webhookEventLogRepository: WebhookEventLogRepository,
    private readonly stripeWebhookValidator: StripeWebhookValidator,
    @InjectQueue(STRIPE_CHECKOUT_QUEUE) private readonly stripeCheckoutQueue: Queue,
  ) { }

  /**
   * Receives Stripe webhook events; verifies signature, logs events, routes to handlers or queue.
   * @param rawBody - Raw request body (required for signature verification)
   * @param signature - stripe-signature header
   * @param language - Language for error messages (default 'en')
   * @returns Success response with received flag or error response
   */
  async handleWebhook(rawBody: Buffer, signature: string, language: string = 'en'): Promise<any> {
    try {
      const { event } = await this.stripeWebhookValidator.validateWebhookEvent(
        rawBody,
        signature,
        language,
      );

      LoggerService.info(`[Stripe Webhook] Received event: ${event.type}`);

      const referenceId = extractStripeReferenceId(event);

      await this.webhookEventLogRepository.create({
        source: WebhookSource.STRIPE,
        event: event.type,
        externalEventId: event.id,
        referenceId,
        payload: event.data.object as Record<string, any>,
      });

      LoggerService.info(`[Stripe Webhook] Stored event: ${event.type} (${event.id})`);

      switch (event.type) {
        case StripeEventType.CHECKOUT_SESSION_COMPLETED: {
          const session = event.data.object as Stripe.Checkout.Session;

          const stripeSubscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id;

          const stripeCustomerId =
            typeof session.customer === 'string'
              ? session.customer
              : session.customer?.id;

          const jobData: StripeCheckoutJobData = {
            stripeSessionId: session.id,
            stripeCustomerId,
            stripeSubscriptionId,
            source: 'webhook',
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

          LoggerService.info(`[Stripe Webhook] Queued checkout session ${session.id} for processing`);
          break;
        }

        case StripeEventType.CUSTOMER_SUBSCRIPTION_CREATED:
          await handleSubscriptionCreated(
            event.data.object as Stripe.Subscription,
            this.subscriptionRepository,
          );
          break;

        case StripeEventType.CUSTOMER_SUBSCRIPTION_UPDATED:
          await handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
            this.subscriptionRepository,
          );
          break;

        case StripeEventType.CUSTOMER_SUBSCRIPTION_DELETED:
          await handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
            this.subscriptionRepository,
          );
          break;

        case StripeEventType.INVOICE_PAYMENT_SUCCEEDED:
          await handleInvoicePaymentSucceeded(
            event.data.object as Stripe.Invoice,
            this.subscriptionRepository,
          );
          break;

        case StripeEventType.INVOICE_PAYMENT_FAILED:
          await handleInvoicePaymentFailed(
            event.data.object as Stripe.Invoice,
            this.subscriptionRepository,
          );
          break;

        default:
          LoggerService.info(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'webhooks.processedSuccessfully', language),
        data: { received: true },
      });
    } catch (error) {
      LoggerService.error(`Webhook processing failed: ${error}`);
      return generateErrorResponse(error);
    }
  }
}
