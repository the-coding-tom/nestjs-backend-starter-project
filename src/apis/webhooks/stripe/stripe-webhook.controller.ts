import { Controller, Post, Req, Res, Headers, RawBodyRequest } from '@nestjs/common';
import { Response } from 'express';
import { StripeWebhookService } from './stripe-webhook.service';
import { ApiRequest } from '../../../common/types/request.types';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  @Post()
  async handleWebhook(
    @Req() request: RawBodyRequest<ApiRequest>,
    @Headers('stripe-signature') signature: string,
    @Res() response: Response,
  ) {
    const rawBody = request.rawBody;

    const { status, ...restOfResponse } = await this.stripeWebhookService.handleWebhook(
      rawBody,
      signature,
      request.language,
    );

    response.status(status).json(restOfResponse);
  }
}

