import { Controller, Get, Post, Query, Body, Req, Res, Headers, RawBodyRequest } from '@nestjs/common';
import { Response, Request } from 'express';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { ApiRequest } from '../../../common/types/request.types';
import { WhatsAppVerificationQuery } from './dto/whatsapp-webhook.dto';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly whatsappWebhookService: WhatsAppWebhookService) {}

  /**
   * Webhook verification endpoint (GET)
   * Meta sends this when configuring the webhook in App Dashboard
   *
   * Must return the challenge value as plain text/number (not JSON)
   */
  @Get()
  handleVerification(
    @Query() query: WhatsAppVerificationQuery,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const challenge = this.whatsappWebhookService.handleVerification(query, request);
    // Must return challenge as plain text, not JSON
    response.status(200).send(String(challenge));
  }

  /**
   * Webhook event notification endpoint (POST)
   * Meta sends delivery status updates and messages here
   *
   * Requires raw body for signature verification
   */
  @Post()
  async handleWebhook(
    @Body() body: unknown,
    @Headers('x-hub-signature-256') signature: string,
    @Req() request: RawBodyRequest<Request> & ApiRequest,
    @Res() response: Response,
  ) {
    // Get raw body for signature verification
    const rawBody = request.rawBody?.toString() || JSON.stringify(body);

    const result = await this.whatsappWebhookService.handleWebhook(
      rawBody,
      body,
      signature,
      request,
    );

    const { status, ...restOfResponse } = result;
    response.status(status).json(restOfResponse);
  }
}
