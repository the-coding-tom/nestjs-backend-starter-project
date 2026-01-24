import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { ErrorCode } from '../../common/enums/generic.enum';
import { UserRepository } from '../../repositories/user.repository';
import { DeviceRepository } from '../../repositories/device.repository';
import { validateJoiSchema } from '../../utils/joi.util';
import { throwError } from '../../helpers/response.helper';
import { translate } from '../../helpers/i18n.helper';
import { RegisterDeviceDto } from './dto/devices.dto';
import * as Joi from 'joi';

@Injectable()
export class DevicesValidator {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly i18n: I18nService,
  ) {}

  async validateRegisterDevice(
    data: RegisterDeviceDto & { userId: number; language: string },
  ): Promise<{ dto: RegisterDeviceDto; existingDevice: any | null }> {
    const schema = Joi.object({
      userId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidUserId', data.language),
        'number.integer': translate(this.i18n, 'validation.invalidUserId', data.language),
        'number.positive': translate(this.i18n, 'validation.invalidUserId', data.language),
        'any.required': translate(this.i18n, 'validation.userId.required', data.language),
      }),
      fcmToken: Joi.string().required().messages({
        'string.empty': translate(this.i18n, 'validation.fcmToken.required', data.language),
        'any.required': translate(this.i18n, 'validation.fcmToken.required', data.language),
      }),
      platform: Joi.string().valid('web', 'android', 'ios').required().messages({
        'any.only': translate(this.i18n, 'validation.platform.invalid', data.language),
        'any.required': translate(this.i18n, 'validation.platform.required', data.language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, { ...data, userId: data.userId, language: data.language });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throwError(
        translate(this.i18n, 'errors.userNotFound', data.language),
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
      );
    }

    const existingDevice = await this.deviceRepository.findByToken(data.fcmToken);

    return { dto: data, existingDevice };
  }

  async validateUnregisterDevice(
    data: { deviceId: number; userId: number; language: string },
  ): Promise<{ device: any }> {
    const schema = Joi.object({
      deviceId: Joi.number().integer().positive().required().messages({
        'number.base': translate(this.i18n, 'validation.invalidId', data.language),
        'number.integer': translate(this.i18n, 'validation.invalidId', data.language),
        'number.positive': translate(this.i18n, 'validation.invalidId', data.language),
        'any.required': translate(this.i18n, 'validation.idRequired', data.language),
      }),
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

    // Check if device exists
    const device = await this.deviceRepository.findById(data.deviceId);
    if (!device) {
      throwError(
        translate(this.i18n, 'errors.deviceNotFound', data.language),
        HttpStatus.NOT_FOUND,
        ErrorCode.RESOURCE_NOT_FOUND,
      );
    }

    // Check if device belongs to user
    if (device.userId !== data.userId) {
      throwError(
        translate(this.i18n, 'errors.deviceAccessDenied', data.language),
        HttpStatus.FORBIDDEN,
        ErrorCode.ACCESS_DENIED,
      );
    }

    return { device };
  }
}

