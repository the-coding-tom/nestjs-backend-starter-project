import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NotificationsValidator } from './notifications.validator';
import { NotificationRepository } from '../../repositories/notification.repository';
import { generateSuccessResponse, generateErrorResponse } from '../../helpers/response.helper';
import { LoggerService } from '../../common/services/logger/logger.service';
import { translate } from '../../helpers/i18n.helper';
import { ApiRequest } from '../../common/types/request.types';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsValidator: NotificationsValidator,
    private readonly notificationRepository: NotificationRepository,
    private readonly i18n: I18nService,
  ) {}

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

