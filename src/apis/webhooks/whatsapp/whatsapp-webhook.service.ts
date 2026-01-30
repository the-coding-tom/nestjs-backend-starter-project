import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { generateSuccessResponse, generateErrorResponse } from '../../../helpers/response.helper';
import { WebhookSource } from '../../../common/enums/generic.enum';
import { translate } from '../../../helpers/i18n.helper';
import { WebhookEventLogRepository } from '../../../repositories/webhook-event-log.repository';
import { WhatsAppWebhookValidator } from './whatsapp-webhook.validator';
import { ApiRequest } from '../../../common/types/request.types';
import {
  WhatsAppVerificationQuery,
  WhatsAppWebhookPayload,
  ProcessedWhatsAppStatus,
} from './dto/whatsapp-webhook.dto';

/**
 * Receives Meta WhatsApp webhooks: verification (GET) and delivery/status events (POST); logs events for idempotency and tracking.
 */
@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly webhookEventLogRepository: WebhookEventLogRepository,
    private readonly whatsappWebhookValidator: WhatsAppWebhookValidator,
  ) {}

  /**
   * Handle webhook verification request (GET)
   * Meta sends this when configuring the webhook endpoint
   *
   * @param query - Query parameters
   * @param request - API request with language
   * @returns Challenge value as plain number (not JSON)
   */
  handleVerification(query: WhatsAppVerificationQuery, request: ApiRequest): number {
    try {
      const challenge = this.whatsappWebhookValidator.validateVerificationRequest(
        query,
        request.language,
      );

      this.logger.log('[WhatsApp Webhook] Verification successful');
      return challenge;
    } catch (error) {
      this.logger.error(`[WhatsApp Webhook] Verification failed: ${error}`);
      throw error;
    }
  }

  /**
   * Handle webhook event notification (POST); processes delivery status updates.
   * @param rawBody - Raw request body for signature verification
   * @param body - Parsed request body (fallback if rawBody missing)
   * @param signature - X-Hub-Signature-256 header
   * @param request - API request with language
   * @returns Success response with received/processed count or error response
   */
  async handleWebhook(
    rawBody: string,
    body: unknown,
    signature: string,
    request: ApiRequest,
  ): Promise<any> {
    try {
      this.whatsappWebhookValidator.verifySignature(
        rawBody,
        signature,
        request.language,
      );

      const payload = this.whatsappWebhookValidator.validatePayload(
        body,
        request.language,
      );

      const statusEvents = await this.extractStatusEvents(payload);

      for (const statusEvent of statusEvents) {
        await this.processStatusEvent(statusEvent);
      }

      this.logger.log(
        `[WhatsApp Webhook] Processed ${statusEvents.length} status event(s)`,
      );

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'webhooks.processedSuccessfully', request.language),
        data: { received: true, processed: statusEvents.length },
      });
    } catch (error) {
      this.logger.error(`[WhatsApp Webhook] Processing failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Extract status events from webhook payload
   * Also checks for duplicates
   *
   * @param payload - Validated webhook payload
   * @returns Array of processed status events
   */
  private async extractStatusEvents(
    payload: WhatsAppWebhookPayload,
  ): Promise<ProcessedWhatsAppStatus[]> {
    const statusEvents: ProcessedWhatsAppStatus[] = [];

    for (const entry of payload.entry) {
      const businessAccountId = entry.id;

      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const { value } = change;
        const phoneNumberId = value.metadata.phone_number_id;

        if (value.statuses) {
          for (const status of value.statuses) {
            const isDuplicate = await this.webhookEventLogRepository.exists(
              WebhookSource.WHATSAPP,
              status.id,
              status.status,
            );

            if (isDuplicate) {
              continue; // Meta may retry; skip duplicate without failing.
            }

            statusEvents.push({
              messageId: status.id,
              status: status.status,
              timestamp: new Date(parseInt(status.timestamp, 10) * 1000),
              recipientId: status.recipient_id,
              phoneNumberId,
              businessAccountId,
              trackingId: status.biz_opaque_callback_data,
              errors: status.errors,
              isBillable: status.pricing?.billable,
            });
          }
        }
      }
    }

    return statusEvents;
  }

  /**
   * Process a single status event
   * Stores in webhook event log and handles status-specific logic
   *
   * @param statusEvent - Processed status event
   */
  private async processStatusEvent(statusEvent: ProcessedWhatsAppStatus): Promise<void> {
    await this.webhookEventLogRepository.create({
      source: WebhookSource.WHATSAPP,
      event: statusEvent.status,
      externalEventId: statusEvent.messageId,
      referenceId: statusEvent.trackingId || statusEvent.messageId,
      payload: {
        messageId: statusEvent.messageId,
        status: statusEvent.status,
        timestamp: statusEvent.timestamp.toISOString(),
        recipientId: statusEvent.recipientId,
        phoneNumberId: statusEvent.phoneNumberId,
        businessAccountId: statusEvent.businessAccountId,
        trackingId: statusEvent.trackingId,
        errors: statusEvent.errors,
        isBillable: statusEvent.isBillable,
      },
    });

    this.logger.log(
      `[WhatsApp Webhook] Status: ${statusEvent.status} for message ${statusEvent.messageId}` +
      (statusEvent.trackingId ? ` (tracking: ${statusEvent.trackingId})` : ''),
    );

    switch (statusEvent.status) {
      case 'sent':
        this.logger.debug(`[WhatsApp] Message ${statusEvent.messageId} sent`);
        break;

      case 'delivered':
        this.logger.debug(`[WhatsApp] Message ${statusEvent.messageId} delivered`);
        break;

      case 'read':
        this.logger.debug(`[WhatsApp] Message ${statusEvent.messageId} read`);
        break;

      case 'failed':
        this.logger.warn(
          `[WhatsApp] Message ${statusEvent.messageId} failed: ${JSON.stringify(statusEvent.errors)}`,
        );
        break;
    }
  }
}
