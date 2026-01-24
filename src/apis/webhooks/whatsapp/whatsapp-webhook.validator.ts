import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import * as crypto from 'crypto';
import * as Joi from 'joi';
import { throwError } from '../../../helpers/response.helper';
import { ErrorCode } from '../../../common/enums/generic.enum';
import { translate } from '../../../helpers/i18n.helper';
import { validateJoiSchema } from '../../../utils/joi.util';
import { config } from '../../../config/config';
import {
  WhatsAppWebhookPayload,
  WhatsAppVerificationQuery,
} from './dto/whatsapp-webhook.dto';

@Injectable()
export class WhatsAppWebhookValidator {
  constructor(
    private readonly i18n: I18nService,
  ) {}

  /**
   * Verify webhook verification request (GET)
   * Meta sends this when configuring the webhook endpoint
   *
   * @param query - Query parameters from Meta
   * @param language - Language for error messages
   * @returns The challenge value to return to Meta
   */
  validateVerificationRequest(
    query: WhatsAppVerificationQuery,
    language: string,
  ): number {
    // Validate query parameters with Joi
    const schema = Joi.object({
      'hub.mode': Joi.string().valid('subscribe').required().messages({
        'any.required': translate(this.i18n, 'validation.modeRequired', language),
        'any.only': translate(this.i18n, 'webhooks.whatsapp.invalidMode', language),
      }),
      'hub.verify_token': Joi.string()
        .valid(config.webhooks.whatsapp.verifyToken)
        .required()
        .messages({
          'any.required': translate(this.i18n, 'validation.tokenRequired', language),
          'any.only': translate(this.i18n, 'validation.invalidToken', language),
        }),
      'hub.challenge': Joi.string().required().messages({
        'any.required': translate(this.i18n, 'validation.challengeRequired', language),
      }),
    });

    const error = validateJoiSchema(schema, query);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    // Return challenge as integer
    return parseInt(query['hub.challenge'], 10);
  }

  /**
   * Verify webhook signature (X-Hub-Signature-256)
   * Uses HMAC-SHA256 with the app secret
   *
   * @param rawBody - Raw request body as string
   * @param signature - X-Hub-Signature-256 header value
   * @param language - Language for error messages
   */
  verifySignature(rawBody: string, signature: string, language: string): void {
    // Validate signature header format with Joi
    const schema = Joi.object({
      signature: Joi.string()
        .pattern(/^sha256=[a-f0-9]+$/)
        .required()
        .messages({
          'any.required': translate(this.i18n, 'webhooks.whatsapp.missingSignature', language),
          'string.pattern.base': translate(this.i18n, 'webhooks.whatsapp.invalidSignatureFormat', language),
        }),
    });

    const error = validateJoiSchema(schema, { signature });
    if (error) throwError(error, HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_TOKEN);

    // Extract signature value after "sha256="
    const receivedSignature = signature.slice(7);

    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', config.webhooks.whatsapp.appSecret)
      .update(rawBody)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(expectedSignature),
    );

    if (!isValid) {
      throwError(
        translate(this.i18n, 'webhooks.whatsapp.invalidSignature', language),
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_TOKEN,
      );
    }
  }

  /**
   * Validate and parse webhook payload
   *
   * @param body - Parsed request body
   * @param language - Language for error messages
   * @returns Validated payload
   */
  validatePayload(body: unknown, language: string): WhatsAppWebhookPayload {
    // Validate webhook payload structure with Joi
    const schema = Joi.object({
      object: Joi.string().valid('whatsapp_business_account').required().messages({
        'any.required': translate(this.i18n, 'webhooks.whatsapp.invalidObjectType', language),
        'any.only': translate(this.i18n, 'webhooks.whatsapp.invalidObjectType', language),
      }),
      entry: Joi.array().min(1).required().messages({
        'any.required': translate(this.i18n, 'webhooks.whatsapp.missingEntries', language),
        'array.min': translate(this.i18n, 'webhooks.whatsapp.missingEntries', language),
      }),
    }).unknown(true);

    const error = validateJoiSchema(schema, body);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    return body as WhatsAppWebhookPayload;
  }
}
