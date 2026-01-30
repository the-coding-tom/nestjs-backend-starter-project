import { Controller, Post, Body, Req, Res, Headers } from '@nestjs/common';
import { Response } from 'express';
import { BrevoWebhookService } from './brevo-webhook.service';
import { ApiRequest } from '../../../common/types/request.types';
import { BrevoWebhookDto } from './dto/brevo-webhook.dto';

@Controller('webhooks/brevo')
export class BrevoWebhookController {
  constructor(private readonly brevoWebhookService: BrevoWebhookService) {}

  /**
   * Receives Brevo email events; verifies token and logs.
   * @param body - Brevo webhook payload (events array)
   * @param authorization - Bearer token for verification
   * @param request - API request
   * @param response - Express response for status and body
   * @returns Response sent via response (success or error)
   */
  @Post()
  async handleWebhook(
    @Body() body: BrevoWebhookDto,
    @Headers('authorization') authorization: string,
    @Req() request: ApiRequest,
    @Res() response: Response,
  ) {
    const { status, ...restOfResponse } = await this.brevoWebhookService.handleWebhook(
      body,
      authorization,
      request,
    );
    response.status(status).json(restOfResponse);
  }
}
