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
   * Handle webhook event notification (POST)
   * Processes delivery status updates
   *
   * @param rawBody - Raw request body for signature verification
   * @param body - Parsed request body
   * @param signature - X-Hub-Signature-256 header
   * @param request - API request with language
   */
  async handleWebhook(
    rawBody: string,
    body: unknown,
    signature: string,
    request: ApiRequest,
  ): Promise<any> {
    try {
      // Verify webhook signature
      this.whatsappWebhookValidator.verifySignature(
        rawBody,
        signature,
        request.language,
      );

      // Validate payload structure
      const payload = this.whatsappWebhookValidator.validatePayload(
        body,
        request.language,
      );

      // Extract status events from payload
      const statusEvents = await this.extractStatusEvents(payload);

      // Process each status event
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

        // Process status updates (delivery receipts)
        if (value.statuses) {
          for (const status of value.statuses) {
            // Check for duplicate event
            const isDuplicate = await this.webhookEventLogRepository.exists(
              WebhookSource.WHATSAPP,
              status.id,
              status.status,
            );

            if (isDuplicate) {
              // Skip duplicate but don't fail - Meta may retry
              continue;
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
    // Store the webhook event
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

    // Log status for monitoring
    this.logger.log(
      `[WhatsApp Webhook] Status: ${statusEvent.status} for message ${statusEvent.messageId}` +
      (statusEvent.trackingId ? ` (tracking: ${statusEvent.trackingId})` : ''),
    );

    // Handle specific statuses
    switch (statusEvent.status) {
      case 'sent':
        // Message sent to Meta's servers
        this.logger.debug(`[WhatsApp] Message ${statusEvent.messageId} sent`);
        break;

      case 'delivered':
        // Message delivered to user's device
        this.logger.debug(`[WhatsApp] Message ${statusEvent.messageId} delivered`);
        break;

      case 'read':
        // User read the message
        this.logger.debug(`[WhatsApp] Message ${statusEvent.messageId} read`);
        break;

      case 'failed':
        // Message delivery failed
        this.logger.warn(
          `[WhatsApp] Message ${statusEvent.messageId} failed: ${JSON.stringify(statusEvent.errors)}`,
        );
        // Could trigger retry logic or notify admin here
        break;
    }
  }
}
