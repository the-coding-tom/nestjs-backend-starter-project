import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { generateSuccessResponse, generateErrorResponse } from '../../../helpers/response.helper';
import { LoggerService } from '../../../common/services/logger/logger.service';
import { WebhookSource } from '../../../common/enums/generic.enum';
import { translate } from '../../../helpers/i18n.helper';
import { WebhookEventLogRepository } from '../../../repositories/webhook-event-log.repository';
import { BrevoWebhookValidator } from './brevo-webhook.validator';
import { ApiRequest } from '../../../common/types/request.types';

/**
 * Receives Brevo webhooks (email events), verifies token, logs events; used for delivery/opens tracking.
 */
@Injectable()
export class BrevoWebhookService {
  constructor(
    private readonly i18n: I18nService,
    private readonly webhookEventLogRepository: WebhookEventLogRepository,
    private readonly brevoWebhookValidator: BrevoWebhookValidator,
  ) { }

  /**
   * Receives Brevo email events; verifies token, logs events.
   * @param body - Brevo webhook payload (events array)
   * @param authorization - Bearer token for verification
   * @param request - API request (language, etc.)
   * @returns Success response with received flag or error response
   */
  async handleWebhook(body: any, authorization: string, request: ApiRequest): Promise<any> {
    try {
      const { event } = await this.brevoWebhookValidator.validateWebhookEvent(
        body,
        authorization,
        request.language,
      );

      await this.webhookEventLogRepository.create({
        source: WebhookSource.BREVO,
        event: event.event,
        externalEventId: String(event.id),
        referenceId: event['message-id'],
        payload: body,
      });

      console.log(`[Brevo Webhook] Stored event: ${event.event}`);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'webhooks.processedSuccessfully', request.language),
        data: { received: true },
      });
    } catch (error) {
      LoggerService.error(`Webhook processing failed: ${error}`);
      return generateErrorResponse(error);
    }
  }
}
