import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { throwError } from '../../../helpers/response.helper';
import { ErrorCode, WebhookSource } from '../../../common/enums/generic.enum';
import { translate } from '../../../helpers/i18n.helper';
import { validateJoiSchema } from '../../../utils/joi.util';
import { verifyWebhookSignature } from '../../../common/services/stripe/stripe.service';
import { WebhookEventLogRepository } from '../../../repositories/webhook-event-log.repository';
import { config } from '../../../config/config';
import Stripe from 'stripe';
import * as Joi from 'joi';

@Injectable()
export class StripeWebhookValidator {
  constructor(
    private readonly i18n: I18nService,
    private readonly webhookEventLogRepository: WebhookEventLogRepository,
  ) {}

  /**
   * Validate Stripe webhook request parameters and verify signature
   */
  async validateWebhookEvent(
    rawBody: Buffer,
    signature: string,
    language: string = 'en',
  ): Promise<{ event: Stripe.Event }> {
    // Validate required parameters using Joi
    const schema = Joi.object({
      rawBody: Joi.binary().required().messages({
        'any.required': translate(this.i18n, 'validation.requestBodyRequired', language),
      }),
      signature: Joi.string().required().messages({
        'any.required': translate(this.i18n, 'validation.stripeSignatureRequired', language),
      }),
      language: Joi.string().optional(),
    });

    const error = validateJoiSchema(schema, { rawBody, signature, language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    // Verify webhook signature and construct event
    const verificationResult = verifyWebhookSignature(
      rawBody,
      signature,
      config.stripe.webhookSecret,
    );

    if (!verificationResult.isValid) {
      const message = translate(this.i18n, 'validation.invalidWebhookSignature', language);
      throwError(message, HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_TOKEN);
    }

    const event = verificationResult.event!;

    // Check for duplicate event (idempotency)
    const isDuplicate = await this.webhookEventLogRepository.exists(
      WebhookSource.STRIPE,
      event.id,
      event.type,
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
