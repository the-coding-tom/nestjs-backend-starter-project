import { Controller, Get, Post, Body, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { ApiRequest } from '../../common/types/request.types';
import {
  CreateCheckoutSessionDto,
  ChangePlanDto,
} from './dto/subscriptions.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  async getSubscription(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.subscriptionsService.getSubscription(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Post('checkout')
  async createCheckoutSession(
    @Body() dto: CreateCheckoutSessionDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.subscriptionsService.createCheckoutSession(
      request.user!.id,
      dto,
      request.user!.email,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Post('change-plan')
  async changePlan(
    @Body() dto: ChangePlanDto,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.subscriptionsService.changePlan(
      request.user!.id,
      dto,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Post('cancel')
  async cancelSubscription(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.subscriptionsService.cancelSubscription(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Get('portal')
  async getPortalSession(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.subscriptionsService.getPortalSession(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Get('invoices')
  async getInvoices(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.subscriptionsService.getInvoices(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  @Get('history')
  async getSubscriptionHistory(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.subscriptionsService.getSubscriptionHistory(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }
}

