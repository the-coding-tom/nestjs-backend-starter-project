import { Controller, Get, Post, Query, Body, Req, Res, Headers, RawBodyRequest } from '@nestjs/common';
import { Response, Request } from 'express';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { ApiRequest } from '../../../common/types/request.types';
import { WhatsAppVerificationQuery } from './dto/whatsapp-webhook.dto';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly whatsappWebhookService: WhatsAppWebhookService) {}

  /**
   * Meta verification (GET); returns challenge as plain text.
   * @param query - hub.mode, hub.verify_token, hub.challenge from Meta
   * @param request - API request
   * @param response - Express response (challenge sent as text)
   * @returns Response sent via response (challenge string)
   */
  @Get()
  handleVerification(
    @Query() query: WhatsAppVerificationQuery,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const challenge = this.whatsappWebhookService.handleVerification(query, request);
    response.status(200).send(String(challenge));
  }

  /**
   * Receives WhatsApp delivery/status events (POST); requires raw body for signature verification.
   * @param body - Parsed webhook payload (fallback if rawBody missing)
   * @param signature - x-hub-signature-256 header for verification
   * @param request - Raw request (rawBody required for signature)
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Post()
  async handleWebhook(
    @Body() body: unknown,
    @Headers('x-hub-signature-256') signature: string,
    @Req() request: RawBodyRequest<Request> & ApiRequest,
    @Res() response: Response,
  ) {
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
