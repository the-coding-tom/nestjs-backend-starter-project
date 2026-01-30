import { Controller, Post, Delete, Body, Param, Req, Res, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { DevicesService } from './devices.service';
import { ApiRequest } from '../../common/types/request.types';
import { RegisterDeviceDto } from './dto/devices.dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /**
   * Register or update FCM token for push notifications.
   * @param dto - Device token and optional name/platform
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Post('register')
  async registerDevice(@Body() dto: RegisterDeviceDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.devicesService.registerDevice(
      request.user!.id,
      dto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Unregister device by ID (removes FCM token).
   * @param id - Device ID to remove
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Delete(':id')
  async unregisterDevice(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.devicesService.unregisterDevice(
      request.user!.id,
      id,
      request,
    );
    response.status(status).json(restOfResponse);
  }
}

