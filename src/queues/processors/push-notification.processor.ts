import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { PUSH_NOTIFICATION_QUEUE } from '../../common/constants/queues.constant';
import { SendPushPayload } from '../../common/services/push/dto/send-push.dto';
import { sendPushNotification } from '../../common/services/push/helpers/fcm.helper';
import { DeviceRepository } from '../../repositories/device.repository';

/**
 * Push Notification Processor
 *
 * Processes push notifications (FCM) for web, iOS, and Android
 * Uses Firebase Cloud Messaging to send push notifications asynchronously.
 * Tracks delivery status and marks invalid tokens for cleanup.
 */
@Processor(PUSH_NOTIFICATION_QUEUE)
export class PushNotificationProcessor implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationProcessor.name);

  constructor(
    @InjectQueue(PUSH_NOTIFICATION_QUEUE) private readonly queue: Queue,
    private readonly deviceRepository: DeviceRepository,
  ) {
    this.logger.log(`[INIT] PushNotificationProcessor initialized for queue: ${PUSH_NOTIFICATION_QUEUE}`);
  }

  onModuleInit() {
    this.logger.log(`[INIT] Setting up queue event listeners for ${PUSH_NOTIFICATION_QUEUE}`);

    this.queue.on('error', (error) => {
      this.logger.error(`[QUEUE ERROR] ${error.message}`, error.stack);
    });

    this.queue.on('waiting', (jobId: string | number) => {
      this.logger.debug(`[EVENT: WAITING] Job ${jobId} is waiting to be processed`);
    });

    this.queue.on('active', (job: Job) => {
      this.logger.log(`[EVENT: ACTIVE] Job ${job.id} is now active (being processed) - Data: ${JSON.stringify(job.data)}`);
    });

    this.queue.on('completed', (job: Job) => {
      this.logger.log(`[EVENT: COMPLETED] Job ${job.id} completed successfully`);
    });

    this.queue.on('failed', (job: Job | undefined, error: Error) => {
      this.logger.error(
        `[EVENT: FAILED] Job ${job?.id || 'unknown'} failed: ${error.message}`,
        error.stack,
      );
    });

    this.queue.on('stalled', (jobId: string | number) => {
      this.logger.warn(`[EVENT: STALLED] Job ${jobId} stalled (took too long to process)`);
    });

    this.queue.on('progress', (job: Job, progress: number | object) => {
      this.logger.debug(`[EVENT: PROGRESS] Job ${job.id} progress: ${JSON.stringify(progress)}`);
    });

    this.logger.log(`[INIT] Queue event listeners registered successfully for ${PUSH_NOTIFICATION_QUEUE}`);
  }

  @Process()
  async handleSendPush(job: Job<SendPushPayload>) {
    const { token, title, body, data } = job.data;

    this.logger.log(`[PROCESS START] Processing job ${job.id} for token: ${token.substring(0, 20)}..., title: ${title}`);
    this.logger.debug(`[PROCESS START] Job ${job.id} data - title: ${title}, body length: ${body.length}`);

    // Find device for status tracking
    const device = await this.deviceRepository.findByToken(token);

    try {
      this.logger.log(`[SENDING] Sending push notification to ${token.substring(0, 20)}...: ${title} (Job ID: ${job.id})`);

      const result = await sendPushNotification({
        token,
        title,
        body,
        data,
      });

      // Update delivery status on success
      if (device) {
        await this.deviceRepository.updateDeliveryStatus(device.id, 'success');
      }

      this.logger.log(`[SEND SUCCESS] Successfully sent push notification to ${token.substring(0, 20)}... (Job ID: ${job.id}, messageId: ${result.messageId})`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = (error as any)?.code;

      this.logger.error(
        `[PROCESS ERROR] Failed to send push notification to ${token.substring(0, 20)}... (Job ID: ${job.id}, Code: ${errorCode}): ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Handle FCM-specific token errors
      if (device && this.isInvalidTokenError(errorCode)) {
        this.logger.warn(
          `[INVALID TOKEN] Marking device ${device.id} token as invalid due to error: ${errorCode}`,
        );
        await this.deviceRepository.markTokenInvalid(device.id);

        // Don't retry for invalid tokens
        return { invalidToken: true };
      }

      // Update delivery status on failure
      if (device) {
        await this.deviceRepository.updateDeliveryStatus(
          device.id,
          'failed',
          errorMessage,
        );
      }

      throw error; // Will trigger retry for other errors
    }
  }

  /**
   * Check if error code indicates an invalid or unregistered token
   * Based on Firebase Cloud Messaging error codes documentation
   */
  private isInvalidTokenError(errorCode: string | undefined): boolean {
    if (!errorCode) return false;

    const invalidTokenCodes = [
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument', // Malformed token
    ];

    return invalidTokenCodes.includes(errorCode);
  }
}

