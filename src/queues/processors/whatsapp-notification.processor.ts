import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { WHATSAPP_NOTIFICATION_QUEUE } from '../../common/constants/queues.constant';
import { SendWhatsAppQueuePayload } from '../../common/services/whatsapp/dto/send-whatsapp.dto';
import { WhatsAppService } from '../../common/services/whatsapp/whatsapp.service';
import { registerQueueEventListeners } from '../helpers/queue-events.helper';

/**
 * WhatsApp Notification Processor
 *
 * Processes WhatsApp template messages asynchronously via Meta Cloud API.
 * Messages are queued by WhatsAppService and processed here.
 */
@Processor(WHATSAPP_NOTIFICATION_QUEUE)
export class WhatsAppNotificationProcessor implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppNotificationProcessor.name);

  constructor(
    @InjectQueue(WHATSAPP_NOTIFICATION_QUEUE) private readonly queue: Queue,
    private readonly whatsappService: WhatsAppService,
  ) {
    this.logger.log(`[INIT] WhatsAppNotificationProcessor initialized for queue: ${WHATSAPP_NOTIFICATION_QUEUE}`);
  }

  onModuleInit() {
    registerQueueEventListeners(this.queue, this.logger, WHATSAPP_NOTIFICATION_QUEUE);
  }

  @Process()
  async handleSendWhatsApp(job: Job<SendWhatsAppQueuePayload>) {
    const { phoneNumber, template, trackingId } = job.data;

    this.logger.log(
      `[PROCESS START] Processing job ${job.id} for phone: ${phoneNumber}, template: ${template.name}`,
    );
    this.logger.debug(`[PROCESS START] Job ${job.id} data - language: ${template.language.code}, trackingId: ${trackingId || 'none'}`);

    try {
      this.logger.log(`[SENDING] Sending WhatsApp template "${template.name}" to ${phoneNumber} (Job ID: ${job.id})`);

      const result = await this.whatsappService.sendWhatsAppTemplate(
        phoneNumber,
        template,
        trackingId,
      );

      const messageId = result.messages[0]?.id;
      const messageStatus = result.messages[0]?.message_status || 'accepted';

      this.logger.log(
        `[SEND SUCCESS] Successfully sent WhatsApp to ${phoneNumber} (Job ID: ${job.id}, WAMID: ${messageId}, status: ${messageStatus})`,
      );

      return {
        messageId,
        messageStatus,
        waId: result.contacts[0]?.wa_id,
      };
    } catch (error) {
      // Handle specific WhatsApp API errors
      if (error instanceof Error) {
        const axiosError = error as any;

        // Check for WhatsApp-specific error codes
        if (axiosError.response?.data?.error) {
          const waError = axiosError.response.data.error;
          this.logger.error(
            `[PROCESS ERROR] WhatsApp API error for ${phoneNumber} (Job ID: ${job.id}): ` +
            `Code: ${waError.code}, Message: ${waError.message}, Type: ${waError.type}`,
          );

          // Don't retry for certain error types (invalid number, blocked, etc.)
          const nonRetryableCodes = [
            131026, // Phone number not on WhatsApp
            131047, // Re-engagement message required
            131051, // Unsupported message type
            132000, // Template not found
            132001, // Template parameter mismatch
            132007, // Template paused
          ];

          if (nonRetryableCodes.includes(waError.code)) {
            this.logger.warn(`[SKIP RETRY] Non-retryable error code ${waError.code} for ${phoneNumber}`);
            // Return instead of throw to prevent retry
            return {
              error: true,
              errorCode: waError.code,
              errorMessage: waError.message,
            };
          }
        }

        this.logger.error(
          `[PROCESS ERROR] Failed to send WhatsApp to ${phoneNumber} (Job ID: ${job.id}): ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `[PROCESS ERROR] Unknown error sending WhatsApp to ${phoneNumber} (Job ID: ${job.id})`,
        );
      }

      throw error; // Will trigger retry
    }
  }
}
