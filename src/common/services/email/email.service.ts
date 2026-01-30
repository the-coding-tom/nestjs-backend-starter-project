import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { I18nService } from 'nestjs-i18n';
import { EMAIL_NOTIFICATION_QUEUE } from '../../constants/queues.constant';
import { config } from '../../../config/config';
import { translate } from '../../../helpers/i18n.helper';
import { convertHtmlToText } from '../../../utils/html-to-text.util';
import {
  SendEmailPayload,
  EmailVerificationNotificationPayload,
  PasswordResetNotificationPayload,
  WelcomeEmailNotificationPayload,
  WorkspaceInvitationEmailNotificationPayload,
} from './dto/send-email.dto';
import { renderEmailTemplate } from './helpers/email-template.helper';

/**
 * Email Notification Service
 * 
 * Handles transactional emails (email verification, password reset, welcome emails, etc.)
 * Uses a queue to send emails asynchronously.
 * 
 * Note: This service is for transactional/auth emails only. These are NOT stored in
 * the Notification table. They are stored in their respective tables:
 * - VerificationRequest (email verification, password reset)
 * - WorkspaceInvitation (workspace invitations)
 * 
 * For in-app notifications (registered users actively using the app), use
 * NotificationHelperService instead, which stores in the Notification table.
 * 
 * Usage:
 * - Inject this service in your modules
 * - Call methods to send transactional emails
 * - Emails are queued and processed by EmailNotificationProcessor
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectQueue(EMAIL_NOTIFICATION_QUEUE)
    private readonly emailNotificationQueue: Queue,
    private readonly i18n: I18nService,
  ) { }

  /**
   * Queue an email to be sent
   */
  private async queueEmail(payload: SendEmailPayload): Promise<string> {
    try {
      const job = await this.emailNotificationQueue.add(payload, {
        attempts: config.queue.jobRetryAttempts,
        backoff: {
          type: 'exponential',
          delay: config.queue.jobRetryDelayMs,
        },
      });
      this.logger.log(`Email job added to queue with ID: ${job.id} for ${payload.to}`);
      return job.id.toString();
    } catch (error) {
      this.logger.error(
        `Failed to queue email for ${payload.to}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Send a generic HTML email (queued). Used by NotificationDispatcherService.
   * @param to - Recipient email
   * @param subject - Email subject
   * @param html - HTML body
   * @param text - Optional plain-text fallback (auto-generated from html if omitted)
   * @returns Queue job ID
   */
  async sendHtml(to: string, subject: string, html: string, text?: string): Promise<string> {
    const payload: SendEmailPayload = {
      to,
      subject,
      html,
      text: text || convertHtmlToText(html),
    };
    return this.queueEmail(payload);
  }

  /**
   * Send email verification notification (queued). Stored in VerificationRequest, not Notification table.
   * @param email - Recipient email
   * @param language - Language for template
   * @param payload - Token for verification link
   * @returns Promise that resolves when email is queued
   */
  async sendEmailVerification(
    email: string,
    language: string,
    payload: EmailVerificationNotificationPayload,
  ): Promise<void> {
    const verificationUrl = `${config.frontendUrl}/verify-email?token=${payload.token}`;
    const subject = translate(this.i18n, 'auth.email.verification.subject', language);
    const title = translate(this.i18n, 'auth.email.verification.title', language);
    const message = translate(this.i18n, 'auth.email.verification.message', language);
    const expiresIn = translate(this.i18n, 'auth.email.verification.expiresIn', language);

    const html = renderEmailTemplate('verification', language, {
      subject,
      title,
      message,
      verificationUrl,
      expiresIn,
    });

    const text = convertHtmlToText(html);

    await this.queueEmail({
      to: email,
      subject,
      html,
      text,
    });

    this.logger.log(`Email verification queued for ${email}`);
  }

  /**
   * Send password reset notification (queued). Stored in VerificationRequest, not Notification table.
   * @param email - Recipient email
   * @param language - Language for template
   * @param payload - Token for reset link
   * @returns Promise that resolves when email is queued
   */
  async sendPasswordReset(
    email: string,
    language: string,
    payload: PasswordResetNotificationPayload,
  ): Promise<void> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${payload.token}`;
    const subject = translate(this.i18n, 'auth.email.resetPassword.subject', language);
    const title = translate(this.i18n, 'auth.email.resetPassword.title', language);
    const message = translate(this.i18n, 'auth.email.resetPassword.message', language);
    const expiresIn = translate(this.i18n, 'auth.email.resetPassword.expiresIn', language);
    const ignoreMessage = translate(this.i18n, 'auth.email.resetPassword.ignoreMessage', language);

    const html = renderEmailTemplate('password-reset', language, {
      subject,
      title,
      message,
      resetUrl,
      expiresIn,
      ignoreMessage,
    });

    const text = convertHtmlToText(html);

    await this.queueEmail({
      to: email,
      subject,
      html,
      text,
    });

    this.logger.log(`Password reset email queued for ${email}`);
  }

  /**
   * Send welcome email (queued). Informational only, not stored in Notification table.
   * @param email - Recipient email
   * @param language - Language for template
   * @param _payload - Optional (unused) payload
   * @returns Promise that resolves when email is queued
   */
  async sendWelcome(
    email: string,
    language: string,
    _payload?: WelcomeEmailNotificationPayload,
  ): Promise<void> {
    const subject = translate(this.i18n, 'auth.email.welcome.subject', language);
    const title = translate(this.i18n, 'auth.email.welcome.title', language);
    const message = translate(this.i18n, 'auth.email.welcome.message', language);

    const html = renderEmailTemplate('welcome', language, {
      subject,
      title,
      message,
      frontendUrl: config.frontendUrl,
    });

    const text = convertHtmlToText(html);

    await this.queueEmail({
      to: email,
      subject,
      html,
      text,
    });

    this.logger.log(`Welcome email queued for ${email}`);
  }

  /**
   * Send workspace invitation notification (queued). Stored in WorkspaceInvitation table.
   * @param email - Recipient email
   * @param language - Language for template
   * @param payload - Workspace name, token, inviter name, role
   * @returns Promise that resolves when email is queued
   */
  async sendWorkspaceInvitation(
    email: string,
    language: string,
    payload: WorkspaceInvitationEmailNotificationPayload,
  ): Promise<void> {
    const invitationUrl = `${config.frontendUrl}/workspaces/invitations/accept?token=${payload.token}`;
    const subject = translate(this.i18n, 'workspaces.email.invitation.subject', language, { workspaceName: payload.workspaceName });
    const title = translate(this.i18n, 'workspaces.email.invitation.title', language);
    const message = translate(this.i18n, 'workspaces.email.invitation.message', language, {
      workspaceName: payload.workspaceName,
      inviterName: payload.inviterName || 'A team member',
    });

    const html = renderEmailTemplate('workspace-invitation', language, {
      subject,
      title,
      message,
      invitationUrl,
    });

    const text = convertHtmlToText(html);

    await this.queueEmail({
      to: email,
      subject,
      html,
      text,
    });

    this.logger.log(`Workspace invitation email queued for ${email} to ${payload.workspaceName}`);
  }
}
