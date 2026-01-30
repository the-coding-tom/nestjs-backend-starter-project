import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NotificationsValidator } from './notifications.validator';
import { NotificationRepository } from '../../repositories/notification.repository';
import { generateSuccessResponse, generateErrorResponse } from '../../helpers/response.helper';
import { LoggerService } from '../../common/services/logger/logger.service';
import { translate } from '../../helpers/i18n.helper';
import { ApiRequest } from '../../common/types/request.types';

/**
 * Serves in-app notifications (inbox): list, pagination, and mark-as-read.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsValidator: NotificationsValidator,
    private readonly notificationRepository: NotificationRepository,
    private readonly i18n: I18nService,
  ) {}

  /**
   * List in-app notifications with pagination and optional unread-only filter.
   * @param userId - User ID
   * @param query - Limit, offset, unreadOnly
   * @param request - API request (language, etc.)
   * @returns Success response with notifications and pagination or error response
   */
  async getNotifications(
    userId: number,
    query: { limit?: number; offset?: number; unreadOnly?: boolean },
    request: ApiRequest,
  ): Promise<any> {
    try {
      const validatedQuery = await this.notificationsValidator.validateGetNotifications(
        { ...query, userId, language: request.language },
      );

      const notifications = await this.notificationRepository.findByUser(userId, {
        limit: validatedQuery.limit,
        offset: validatedQuery.offset,
        unreadOnly: validatedQuery.unreadOnly,
      });

      const totalCount = await this.notificationRepository.countByUser(userId);
      const unreadCount = await this.notificationRepository.countByUser(userId, true);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'notifications.retrieved', request.language),
        data: {
          notifications,
          pagination: {
            total: totalCount,
            unread: unreadCount,
            limit: validatedQuery.limit ?? 50,
            offset: validatedQuery.offset ?? 0,
          },
        },
      });
    } catch (error) {
      LoggerService.error(`Failed to retrieve notifications: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Mark a single notification as read.
   * @param userId - User ID
   * @param notificationId - Notification ID
   * @param request - API request (language, etc.)
   * @returns Success response or error response
   */
  async markAsRead(userId: number, notificationId: number, request: ApiRequest): Promise<any> {
    try {
      await this.notificationsValidator.validateMarkAsRead({
        userId,
        notificationId,
        language: request.language,
      });

      await this.notificationRepository.update(notificationId, {
        readAt: new Date(),
      });

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'notifications.markedAsRead', request.language),
      });
    } catch (error) {
      LoggerService.error(`Failed to mark notification as read: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Mark all notifications as read for user.
   * @param userId - User ID
   * @param request - API request (language, etc.)
   * @returns Success response or error response
   */
  async markAllAsRead(userId: number, request: ApiRequest): Promise<any> {
    try {
      await this.notificationsValidator.validateMarkAllAsRead({
        userId,
        language: request.language,
      });

      await this.notificationRepository.markAllAsRead(userId);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'notifications.allMarkedAsRead', request.language),
      });
    } catch (error) {
      LoggerService.error(`Failed to mark all notifications as read: ${error}`);
      return generateErrorResponse(error);
    }
  }
}

