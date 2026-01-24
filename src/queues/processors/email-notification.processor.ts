import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { EMAIL_NOTIFICATION_QUEUE } from '../../common/constants/queues.constant';
import { SendEmailPayload } from '../../common/services/email/dto/send-email.dto';
import { sendEmail } from '../../common/services/brevo/brevo.service';
import { registerQueueEventListeners } from '../helpers/queue-events.helper';

/**
 * Email Notification Processor
 * 
 * Processes email notifications (email verification, password reset, welcome emails, etc.)
 * Uses Brevo API to send emails asynchronously.
 */
@Processor(EMAIL_NOTIFICATION_QUEUE)
export class EmailNotificationProcessor implements OnModuleInit {
  private readonly logger = new Logger(EmailNotificationProcessor.name);

  constructor(@InjectQueue(EMAIL_NOTIFICATION_QUEUE) private readonly queue: Queue) {
    this.logger.log(`[INIT] EmailNotificationProcessor initialized for queue: ${EMAIL_NOTIFICATION_QUEUE}`);
  }

  onModuleInit() {
    registerQueueEventListeners(this.queue, this.logger, EMAIL_NOTIFICATION_QUEUE);
  }

  @Process()
  async handleSendEmail(job: Job<SendEmailPayload>) {
    const { to, subject, html, text } = job.data;

    this.logger.log(`[PROCESS START] Processing job ${job.id} for email: ${to}, subject: ${subject}`);
    this.logger.debug(`[PROCESS START] Job ${job.id} data - html length: ${html?.length}, text length: ${text?.length}`);

    try {
      this.logger.log(`[SENDING] Sending email to ${to}: ${subject} (Job ID: ${job.id})`);

      const result = await sendEmail(to, subject, html, text);

      this.logger.log(`[SEND SUCCESS] Successfully sent email to ${to} (Job ID: ${job.id}, messageId: ${result.messageId})`);
      return result;
    } catch (error) {
      this.logger.error(
        `[PROCESS ERROR] Failed to send email to ${to} (Job ID: ${job.id}): ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error; // Will trigger retry
    }
  }
}

