import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { throwError } from '../../../helpers/response.helper';
import { ErrorCode, WebhookSource } from '../../../common/enums/generic.enum';
import { translate } from '../../../helpers/i18n.helper';
import { validateJoiSchema } from '../../../utils/joi.util';
import { BrevoWebhookEvent } from './dto/brevo-webhook.dto';
import { verifyBrevoWebhookToken } from '../../../common/services/brevo/brevo.service';
import { WebhookEventLogRepository } from '../../../repositories/webhook-event-log.repository';
import { config } from '../../../config/config';
import * as Joi from 'joi';

@Injectable()
export class BrevoWebhookValidator {
  constructor(
    private readonly i18n: I18nService,
    private readonly webhookEventLogRepository: WebhookEventLogRepository,
  ) {}

  /**
   * Validate Brevo webhook event structure and verify authorization
   */
  async validateWebhookEvent(
    body: any,
    authorization: string,
    language: string,
  ): Promise<{ event: BrevoWebhookEvent }> {
    // Validate event structure and authorization using Joi
    const schema = Joi.object({
      authorization: Joi.string().required().messages({
        'any.required': translate(this.i18n, 'validation.token.required', language),
      }),
      event: Joi.string()
        .valid(
          'request',
          'sent',
          'delivered',
          'hard_bounce',
          'soft_bounce',
          'click',
          'opened',
          'unique_opened',
          'proxy_open',
          'unique_proxy_open',
          'spam',
          'deferred',
          'blocked',
          'error',
          'invalid_email',
          'unsubscribed',
        )
        .required()
        .messages({
          'any.only': translate(this.i18n, 'validation.invalidEventType', language),
          'any.required': translate(this.i18n, 'validation.eventTypeRequired', language),
        }),
      email: Joi.string().email({ tlds: { allow: false } }).required().messages({
        'string.email': translate(this.i18n, 'validation.email.invalid', language),
        'any.required': translate(this.i18n, 'validation.email.required', language),
      }),
      id: Joi.number().integer().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidId', language),
        'any.required': translate(this.i18n, 'validation.idRequired', language),
      }),
      date: Joi.string().required().messages({
        'any.required': translate(this.i18n, 'validation.dateRequired', language),
      }),
      ts: Joi.number().required().messages({
        'any.required': translate(this.i18n, 'validation.timestampRequired', language),
      }),
      'message-id': Joi.string().required().messages({
        'any.required': translate(this.i18n, 'validation.messageIdRequired', language),
      }),
      ts_event: Joi.number().required().messages({
        'any.required': translate(this.i18n, 'validation.eventTimestampRequired', language),
      }),
      // Optional fields - allow empty strings as Brevo may send empty values
      subject: Joi.string().allow('').optional(),
      template_id: Joi.number().optional(),
      tags: Joi.array().items(Joi.string()).optional(),
      tag: Joi.string().allow('').optional(),
      ts_epoch: Joi.number().optional(),
      link: Joi.string().allow('').optional(),
      user_agent: Joi.string().allow('').optional(),
      device_used: Joi.string().allow('').optional(),
      contact_id: Joi.number().optional(),
      mirror_link: Joi.string().allow('').optional(),
      reason: Joi.string().allow('').optional(),
      sending_ip: Joi.string().allow('').optional(),
      sender_email: Joi.string().allow('').optional(),
      'X-Mailin-custom': Joi.string().allow('').optional(),
      uuid: Joi.string().allow('').optional(),
    }).unknown(true);

    const error = validateJoiSchema(schema, { ...body, authorization });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    // Verify bearer token
    const isValid = verifyBrevoWebhookToken(
      authorization,
      config.webhooks.brevo.bearerToken,
    );

    if (!isValid) {
      throwError(
        translate(this.i18n, 'validation.invalidToken', language),
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_TOKEN,
      );
    }

    const event = body as BrevoWebhookEvent;

    // Check for duplicate event (idempotency)
    const isDuplicate = await this.webhookEventLogRepository.exists(
      WebhookSource.BREVO,
      event['message-id'],
      event.event,
    );

    if (isDuplicate) {
      throwError(
        translate(this.i18n, 'errors.duplicateWebhookEvent', language),
        HttpStatus.OK,
        ErrorCode.DUPLICATE_WEBHOOK_EVENT,
      );
    }

    return { event };
  }
}
