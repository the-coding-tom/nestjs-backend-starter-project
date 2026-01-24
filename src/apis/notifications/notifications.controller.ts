import { Controller, Get, Patch, Param, Req, Res, Query, ParseIntPipe } from '@nestjs/common';
import { Response } from 'express';
import { NotificationsService } from './notifications.service';
import { ApiRequest } from '../../common/types/request.types';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Req() request: ApiRequest,
    @Res() response: Response,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const { status, ...restOfResponse } = await this.notificationsService.getNotifications(
      request.user!.id,
      {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
        unreadOnly: unreadOnly === 'true',
      },
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.notificationsService.markAsRead(
      request.user!.id,
      id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Patch('read-all')
  async markAllAsRead(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.notificationsService.markAllAsRead(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }
}

