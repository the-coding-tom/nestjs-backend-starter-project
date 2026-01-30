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

  /**
   * Get current user's subscription with plan and billing info.
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (subscription or null)
   */
  @Get()
  async getSubscription(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.subscriptionsService.getSubscription(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Create Stripe checkout session; returns checkout URL.
   * @param dto - Plan ID and success/cancel URLs
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (checkout URL and session id)
   */
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

  /**
   * Change subscription plan (upgrade or downgrade); proration applied for upgrades.
   * @param dto - New plan ID
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
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

  /**
   * Cancel subscription at period end (access until current period ends).
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Post('cancel')
  async cancelSubscription(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.subscriptionsService.cancelSubscription(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Get Stripe customer portal URL for managing payment method and billing.
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (portal URL)
   */
  @Get('portal')
  async getPortalSession(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.subscriptionsService.getPortalSession(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * List recent Stripe invoices for current user.
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (invoices array)
   */
  @Get('invoices')
  async getInvoices(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.subscriptionsService.getInvoices(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }

  /**
   * Get subscription change history (plan changes, cancellations).
   * @param request - API request (user context)
   * @param response - Express response for status and body
   * @returns Response sent via response (history array)
   */
  @Get('history')
  async getSubscriptionHistory(@Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.subscriptionsService.getSubscriptionHistory(
      request.user!.id,
      request,
    );
    response.status(status).json(restOfResponse);
  }
}

