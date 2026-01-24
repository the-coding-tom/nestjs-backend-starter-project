import { HttpStatus, Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DevicesValidator } from './devices.validator';
import { DeviceRepository } from '../../repositories/device.repository';
import { generateSuccessResponse, generateErrorResponse } from '../../helpers/response.helper';
import { LoggerService } from '../../common/services/logger/logger.service';
import { translate } from '../../helpers/i18n.helper';
import { RegisterDeviceDto } from './dto/devices.dto';
import { ApiRequest } from '../../common/types/request.types';

@Injectable()
export class DevicesService {
  constructor(
    private readonly devicesValidator: DevicesValidator,
    private readonly deviceRepository: DeviceRepository,
    private readonly i18n: I18nService,
  ) {}

  async registerDevice(userId: number, dto: RegisterDeviceDto, request: ApiRequest): Promise<any> {
    try {
      const { existingDevice } = await this.devicesValidator.validateRegisterDevice({
        ...dto,
        userId,
        language: request.language,
      });

      if (existingDevice) {
        if (existingDevice.userId !== userId) {
          LoggerService.error(`Device already registered to another user: ${new Error('Device conflict')}`);
          return generateErrorResponse(new Error('Device conflict'));
        }

        await this.deviceRepository.updateByToken(dto.fcmToken, {
          platform: dto.platform,
          enabled: true,
        });

        return generateSuccessResponse({
          statusCode: HttpStatus.OK,
          message: translate(this.i18n, 'devices.updated', request.language),
        });
      }

      await this.deviceRepository.create({
        userId,
        fcmToken: dto.fcmToken,
        platform: dto.platform,
        enabled: true,
      });

      return generateSuccessResponse({
        statusCode: HttpStatus.CREATED,
        message: translate(this.i18n, 'devices.registered', request.language),
      });
    } catch (error) {
      LoggerService.error(`Device registration failed: ${error}`);
      return generateErrorResponse(error);
    }
  }

  async unregisterDevice(userId: number, deviceId: number, request: ApiRequest): Promise<any> {
    try {
      // Validate device exists and belongs to user
      await this.devicesValidator.validateUnregisterDevice({
        deviceId,
        userId,
        language: request.language,
      });

      await this.deviceRepository.delete(deviceId, userId);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'devices.unregistered', request.language),
      });
    } catch (error) {
      LoggerService.error(`Device unregistration failed: ${error}`);
      return generateErrorResponse(error);
    }
  }
}

