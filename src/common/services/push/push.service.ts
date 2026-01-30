import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PUSH_NOTIFICATION_QUEUE } from '../../constants/queues.constant';
import { config } from '../../../config/config';
import { NotificationType, NotificationStatus, NotificationAction } from '../../enums/generic.enum';
import {
  SendPushPayload,
  PushNotificationData,
  SubscriptionExpiringNotificationPayload,
  SubscriptionExpiredNotificationPayload,
  WorkspaceInvitationAcceptedNotificationPayload,
} from './dto/send-push.dto';
import { renderPushTemplate } from './helpers/push-template.helper';
import { NotificationRepository } from '../../../repositories/notification.repository';
import { DeviceRepository } from '../../../repositories/device.repository';

/**
 * Push Notification Service
 *
 * Handles push notifications via FCM for web, iOS, and Android
 * Uses a queue to send push notifications asynchronously.
 *
 * Each method handles a complete notification flow:
 * 1. Render template with variables
 * 2. Create notification in database (source of truth)
 * 3. Get user's devices
 * 4. Queue push notifications
 *
 * Usage:
 * - Inject this service in your modules
 * - Call methods to send push notifications
 * - Notifications are queued and processed by PushNotificationProcessor
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectQueue(PUSH_NOTIFICATION_QUEUE)
    private readonly pushNotificationQueue: Queue,
    private readonly notificationRepository: NotificationRepository,
    private readonly deviceRepository: DeviceRepository,
  ) { }

  /**
   * Queue a push notification to be sent
   */
  private async queuePush(payload: SendPushPayload): Promise<void> {
    try {
      const job = await this.pushNotificationQueue.add(payload, {
        attempts: config.queue.jobRetryAttempts,
        backoff: {
          type: 'exponential',
          delay: config.queue.jobRetryDelayMs,
        },
      });
      this.logger.log(`Push notification job added to queue with ID: ${job.id} for token: ${payload.token.substring(0, 20)}...`);
    } catch (error) {
      this.logger.error(
        `Failed to queue push notification for token ${payload.token.substring(0, 20)}...: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Queue push notifications to multiple devices
   */
  private async queuePushToMultipleDevices(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (tokens.length === 0) {
      this.logger.debug('No tokens provided for push notification, skipping queueing.');
      return;
    }

    const promises = tokens.map((token) =>
      this.queuePush({
        token,
        title,
        body,
        data,
      }),
    );

    await Promise.all(promises);

    this.logger.log(`Push notifications queued for ${tokens.length} devices`);
  }

  /**
   * Send generic push notification to multiple devices (queued). Used by NotificationDispatcherService.
   * @param tokens - FCM device tokens
   * @param title - Notification title
   * @param body - Notification body
   * @param data - Optional key-value data payload
   * @returns Promise that resolves when pushes are queued
   */
  async send(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    return this.queuePushToMultipleDevices(tokens, title, body, data);
  }

  /**
   * Send subscription expiring notification: creates DB notification and queues push to user devices.
   * @param userId - User ID
   * @param language - Language for template
   * @param payload - Expiry date and optional metadata
   * @returns Created notification record
   */
  async sendSubscriptionExpiringNotification(
    userId: number,
    language: string,
    payload: SubscriptionExpiringNotificationPayload,
  ): Promise<any> {
    // 1. Render template for notification title/body
    const { title, body } = renderPushTemplate('subscription_expiring', language, { expiryDate: payload.expiryDate });

    // 2. Create notification in database (source of truth)
    const notification = await this.notificationRepository.create({
      userId,
      title,
      body,
      type: NotificationType.SUBSCRIPTION,
      payload: { ...payload, status: NotificationStatus.EXPIRING },
    });

    // 3. Get user's enabled devices
    const devices = await this.deviceRepository.findByUser(userId);

    if (devices.length === 0) {
      this.logger.debug(`No devices found for user ${userId}, notification saved but no push sent`);
      return notification;
    }

    // 4. Queue push notifications for each device
    const tokens = devices.map((device) => device.fcmToken);
    const notificationData: PushNotificationData = {
      notificationId: String(notification.id),
      type: NotificationType.SUBSCRIPTION,
      status: NotificationStatus.EXPIRING,
      ...payload,
    };

    await this.queuePushToMultipleDevices(tokens, title, body, notificationData);
    this.logger.log(`Subscription expiring notification ${notification.id} created and queued for ${tokens.length} device(s)`);

    return notification;
  }

  /**
   * Send subscription expired notification: creates DB notification and queues push to user devices.
   * @param userId - User ID
   * @param language - Language for template
   * @param payload - Optional metadata
   * @returns Created notification record
   */
  async sendSubscriptionExpiredNotification(
    userId: number,
    language: string,
    payload?: SubscriptionExpiredNotificationPayload,
  ): Promise<any> {
    // 1. Render template for notification title/body
    const { title, body } = renderPushTemplate('subscription_expired', language, {});

    // 2. Create notification in database (source of truth)
    const notification = await this.notificationRepository.create({
      userId,
      title,
      body,
      type: NotificationType.SUBSCRIPTION,
      payload: { ...payload, status: NotificationStatus.EXPIRED },
    });

    // 3. Get user's enabled devices
    const devices = await this.deviceRepository.findByUser(userId);

    if (devices.length === 0) {
      this.logger.debug(`No devices found for user ${userId}, notification saved but no push sent`);
      return notification;
    }

    // 4. Queue push notifications for each device
    const tokens = devices.map((device) => device.fcmToken);
    const notificationData: PushNotificationData = {
      notificationId: String(notification.id),
      type: NotificationType.SUBSCRIPTION,
      status: NotificationStatus.EXPIRED,
      ...payload,
    };

    await this.queuePushToMultipleDevices(tokens, title, body, notificationData);
    this.logger.log(`Subscription expired notification ${notification.id} created and queued for ${tokens.length} device(s)`);

    return notification;
  }

  /**
   * Send workspace invitation accepted notification: creates DB notification and queues push to user devices.
   * @param userId - User ID (workspace owner to notify)
   * @param language - Language for template
   * @param payload - Member name, workspace name
   * @returns Created notification record
   */
  async sendWorkspaceInvitationAcceptedNotification(
    userId: number,
    language: string,
    payload: WorkspaceInvitationAcceptedNotificationPayload,
  ): Promise<any> {
    // 1. Render template for notification title/body
    const { title, body } = renderPushTemplate('workspace_invitation_accepted', language, {
      memberName: payload.memberName,
      workspaceName: payload.workspaceName,
    });

    // 2. Create notification in database (source of truth)
    const notification = await this.notificationRepository.create({
      userId,
      title,
      body,
      type: NotificationType.WORKSPACE_INVITATION,
      payload: { ...payload, action: NotificationAction.ACCEPTED },
    });

    // 3. Get user's enabled devices
    const devices = await this.deviceRepository.findByUser(userId);

    if (devices.length === 0) {
      this.logger.debug(`No devices found for user ${userId}, notification saved but no push sent`);
      return notification;
    }

    // 4. Queue push notifications for each device
    const tokens = devices.map((device) => device.fcmToken);
    const notificationData: PushNotificationData = {
      notificationId: String(notification.id),
      type: NotificationType.WORKSPACE_INVITATION,
      action: NotificationAction.ACCEPTED,
      ...payload,
    };

    await this.queuePushToMultipleDevices(tokens, title, body, notificationData);
    this.logger.log(`Workspace invitation accepted notification ${notification.id} created and queued for ${tokens.length} device(s)`);

    return notification;
  }
}
