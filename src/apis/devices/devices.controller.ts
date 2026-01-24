import { Controller, Post, Delete, Body, Param, Req, Res, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { DevicesService } from './devices.service';
import { ApiRequest } from '../../common/types/request.types';
import { RegisterDeviceDto } from './dto/devices.dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  async registerDevice(@Body() dto: RegisterDeviceDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.devicesService.registerDevice(
      request.user!.id,
      dto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

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

