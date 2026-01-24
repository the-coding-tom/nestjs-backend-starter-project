import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import axios, { AxiosInstance } from 'axios';
import { readFileSync } from 'fs';
import { join } from 'path';
import { WHATSAPP_NOTIFICATION_QUEUE } from '../../constants/queues.constant';
import { config } from '../../../config/config';
import {
  WhatsAppTemplatePayload,
  WhatsAppTemplateComponent,
  WhatsAppTemplateParameter,
  WhatsAppTemplateMappings,
  WhatsAppSendResponse,
} from './dto/whatsapp-api.dto';
import {
  SendWhatsAppQueuePayload,
  VerificationCodePayload,
} from './dto/send-whatsapp.dto';

/**
 * WhatsApp Notification Service
 *
 * Handles transactional WhatsApp messages via Meta Cloud API.
 * Uses a queue to send messages asynchronously.
 *
 * IMPORTANT: WhatsApp requires pre-approved templates for business-initiated messages.
 * Templates must be created and approved in WhatsApp Business Manager before use.
 * This service maps internal template types to Meta-approved template names.
 *
 * Usage:
 * - Inject this service in your modules
 * - Call methods to send transactional WhatsApp messages
 * - Messages are queued and processed by WhatsAppNotificationProcessor
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private whatsappClient: AxiosInstance | null = null;
  private readonly templateMappingCache = new Map<string, WhatsAppTemplateMappings>();

  constructor(
    @InjectQueue(WHATSAPP_NOTIFICATION_QUEUE)
    private readonly whatsappNotificationQueue: Queue,
  ) {}

  /**
   * Send a template message directly via WhatsApp Cloud API
   *
   * @param phoneNumber - Recipient phone number (with country code)
   * @param template - Pre-built template payload
   * @param trackingId - Optional tracking ID (returned in webhook)
   * @returns WhatsApp API response with message ID
   */
  async sendWhatsAppTemplate(
    phoneNumber: string,
    template: WhatsAppTemplatePayload,
    trackingId?: string,
  ): Promise<WhatsAppSendResponse> {
    const client = this.getWhatsAppClient();

    // Remove leading '+' from phone number if present
    const formattedPhoneNumber = phoneNumber.replace(/^\+/, '');

    const requestBody: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhoneNumber,
      type: 'template',
      template,
    };

    // Add tracking data if provided (max 512 chars)
    if (trackingId) {
      requestBody.biz_opaque_callback_data = trackingId.slice(0, 512);
    }

    const response = await client.post<WhatsAppSendResponse>(
      `/${config.whatsapp.phoneNumberId}/messages`,
      requestBody,
    );

    return response.data;
  }

  /**
   * Send verification code via WhatsApp
   *
   * Requires Meta template: otp_verification (or similar authentication template)
   *
   * @param phoneNumber - Recipient phone number
   * @param language - Language code
   * @param payload - Verification code payload
   * @returns Job ID
   */
  async sendVerificationCode(
    phoneNumber: string,
    language: string,
    payload: VerificationCodePayload,
  ): Promise<string> {
    const jobId = await this.sendTemplate(phoneNumber, 'verification_code', language, {
      code: payload.code,
      expiryMinutes: String(payload.expiryMinutes),
    });

    this.logger.log(`Verification code WhatsApp queued for ${phoneNumber}`);
    return jobId;
  }

  // ============================================
  // Private Methods
  // ============================================

  private async sendTemplate(
    phoneNumber: string,
    templateType: string,
    language: string,
    variables: Record<string, string | number>,
    trackingId?: string,
  ): Promise<string> {
    const template = this.buildTemplatePayload(templateType, language, variables);

    const payload: SendWhatsAppQueuePayload = {
      phoneNumber,
      template,
      trackingId,
    };

    return this.queueMessage(payload);
  }

  private getWhatsAppClient(): AxiosInstance {
    if (!this.whatsappClient) {
      if (!config.whatsapp.accessToken) {
        throw new Error('WhatsApp access token is not configured');
      }
      if (!config.whatsapp.phoneNumberId) {
        throw new Error('WhatsApp phone number ID is not configured');
      }

      this.whatsappClient = axios.create({
        baseURL: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}`,
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    }
    return this.whatsappClient;
  }

  private async queueMessage(payload: SendWhatsAppQueuePayload): Promise<string> {
    try {
      const job = await this.whatsappNotificationQueue.add(payload, {
        attempts: config.queue.jobRetryAttempts,
        backoff: {
          type: 'exponential',
          delay: config.queue.jobRetryDelayMs,
        },
      });
      this.logger.log(`WhatsApp job added to queue with ID: ${job.id} for ${payload.phoneNumber}`);
      return job.id.toString();
    } catch (error) {
      this.logger.error(
        `Failed to queue WhatsApp message for ${payload.phoneNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private buildTemplatePayload(
    templateType: string,
    language: string,
    variables: Record<string, string | number>,
  ): WhatsAppTemplatePayload {
    const mappings = this.loadTemplateMappings(language);

    if (!mappings[templateType]) {
      // Fallback to default language if template type not found
      if (language !== config.defaultLanguage) {
        return this.buildTemplatePayload(templateType, config.defaultLanguage, variables);
      }
      throw new Error(`WhatsApp template type not found: ${templateType} for language: ${language}`);
    }

    const mapping = mappings[templateType];
    const components: WhatsAppTemplateComponent[] = [];

    // Build header component if header parameters exist
    if (mapping.headerParameters && mapping.headerParameters.length > 0) {
      const headerParams: WhatsAppTemplateParameter[] = mapping.headerParameters.map((paramName) => ({
        type: 'text' as const,
        text: String(variables[paramName] ?? ''),
      }));

      components.push({
        type: 'header',
        parameters: headerParams,
      });
    }

    // Build body component with parameters
    if (mapping.parameterOrder && mapping.parameterOrder.length > 0) {
      const bodyParams: WhatsAppTemplateParameter[] = mapping.parameterOrder.map((paramName) => ({
        type: 'text' as const,
        text: String(variables[paramName] ?? ''),
      }));

      components.push({
        type: 'body',
        parameters: bodyParams,
      });
    }

    // Build button components if button parameters exist
    if (mapping.buttonParameters) {
      for (const button of mapping.buttonParameters) {
        const buttonParams: WhatsAppTemplateParameter[] = button.parameters.map((paramName) => ({
          type: 'text' as const,
          text: String(variables[paramName] ?? ''),
        }));

        components.push({
          type: 'button',
          sub_type: button.type,
          index: button.index,
          parameters: buttonParams,
        });
      }
    }

    return {
      name: mapping.metaTemplateName,
      language: {
        policy: 'deterministic',
        code: mapping.languageCode,
      },
      components: components.length > 0 ? components : undefined,
    };
  }

  private loadTemplateMappings(language: string): WhatsAppTemplateMappings {
    // Return cached mappings if available
    if (this.templateMappingCache.has(language)) {
      return this.templateMappingCache.get(language)!;
    }

    // Determine template path
    const templatePath = config.isProduction
      ? join(process.cwd(), 'dist/common/services/whatsapp/templates', language, 'templates.json')
      : join(process.cwd(), 'src/common/services/whatsapp/templates', language, 'templates.json');

    try {
      const templateContent = readFileSync(templatePath, 'utf-8');
      const mappings = JSON.parse(templateContent) as WhatsAppTemplateMappings;
      this.templateMappingCache.set(language, mappings);
      return mappings;
    } catch (error) {
      this.logger.error(`Error loading WhatsApp template mappings for language: ${language}`, error);
      this.logger.error(`Template path: ${templatePath}`);
      // Fallback to default language if template not found
      if (language !== config.defaultLanguage) {
        this.logger.warn(`Fallback to default language: ${config.defaultLanguage}`);
        return this.loadTemplateMappings(config.defaultLanguage);
      }
      throw new Error(`WhatsApp template mappings not found for language: ${language}`);
    }
  }
}
