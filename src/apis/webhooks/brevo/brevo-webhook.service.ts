import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { generateSuccessResponse, generateErrorResponse } from '../../../helpers/response.helper';
import { LoggerService } from '../../../common/services/logger/logger.service';
import { WebhookSource } from '../../../common/enums/generic.enum';
import { translate } from '../../../helpers/i18n.helper';
import { WebhookEventLogRepository } from '../../../repositories/webhook-event-log.repository';
import { BrevoWebhookValidator } from './brevo-webhook.validator';
import { ApiRequest } from '../../../common/types/request.types';

@Injectable()
export class BrevoWebhookService {
  constructor(
    private readonly i18n: I18nService,
    private readonly webhookEventLogRepository: WebhookEventLogRepository,
    private readonly brevoWebhookValidator: BrevoWebhookValidator,
  ) { }

  async handleWebhook(body: any, authorization: string, request: ApiRequest): Promise<any> {
    try {
      // Validate webhook event structure, verify token, and check for duplicates
      const { event } = await this.brevoWebhookValidator.validateWebhookEvent(
        body,
        authorization,
        request.language,
      );

      // Store the raw webhook event
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
