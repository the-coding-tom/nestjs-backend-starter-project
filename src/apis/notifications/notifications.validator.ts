import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ErrorCode } from '../../common/enums/generic.enum';
import { NotificationRepository } from '../../repositories/notification.repository';
import { validateJoiSchema } from '../../utils/joi.util';
import { throwError } from '../../helpers/response.helper';
import { translate } from '../../helpers/i18n.helper';
import * as Joi from 'joi';

@Injectable()
export class NotificationsValidator {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly i18n: I18nService,
  ) {}

  async validateGetNotifications(data: {
    userId: number;
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    language: string;
  }): Promise<{ limit: number; offset: number; unreadOnly?: boolean }> {
    const schema = Joi.object({
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', data.language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', data.language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', data.language),
        'any.required': translate(this.i18n, 'validation.userId.required', data.language),
      }),
      limit: Joi.number().integer().min(1).max(100).optional().messages({
        'number.base': translate(this.i18n, 'validation.limit.invalid', data.language),
        'number.min': translate(this.i18n, 'validation.limit.min', data.language),
        'number.max': translate(this.i18n, 'validation.limit.max', data.language),
      }),
      offset: Joi.number().integer().min(0).optional().messages({
        'number.base': translate(this.i18n, 'validation.offset.invalid', data.language),
        'number.min': translate(this.i18n, 'validation.offset.min', data.language),
      }),
      unreadOnly: Joi.boolean().optional(),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    return {
      limit: data.limit ?? 50,
      offset: data.offset ?? 0,
      unreadOnly: data.unreadOnly,
    };
  }

  async validateMarkAsRead(data: {
    userId: number;
    notificationId: number;
    language: string;
  }): Promise<void> {
    const schema = Joi.object({
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', data.language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', data.language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', data.language),
        'any.required': translate(this.i18n, 'validation.userId.required', data.language),
      }),
      notificationId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidNotificationId', data.language),
        'number.integer': translate(this.i18n, 'validation.invalidNotificationId', data.language),
        'number.positive': translate(this.i18n, 'validation.invalidNotificationId', data.language),
        'any.required': translate(this.i18n, 'validation.notificationId.required', data.language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const notification = await this.notificationRepository.findById(data.notificationId);
    if (!notification) {
      throwError(
        translate(this.i18n, 'errors.notificationNotFound', data.language),
        HttpStatus.NOT_FOUND,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (notification.userId !== data.userId) {
      throwError(
        translate(this.i18n, 'errors.notificationAccessDenied', data.language),
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTHENTICATION_ERROR,
      );
    }
  }

  async validateMarkAllAsRead(data: { userId: number; language: string }): Promise<void> {
    const schema = Joi.object({
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', data.language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', data.language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', data.language),
        'any.required': translate(this.i18n, 'validation.userId.required', data.language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
  }
}

