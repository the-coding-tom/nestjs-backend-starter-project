import { Controller, Get, Query, Param, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { PlansService } from './plans.service';
import { ApiRequest } from '../../common/types/request.types';
import { GetPlansQueryDto } from './dto/plans.dto';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  /**
   * List all plans with optional filters.
   * @param query - Optional filters (e.g. slug, active)
   * @param request - API request (language, etc.)
   * @param response - Express response for status and body
   * @returns Response sent via response (plans array)
   */
  @Get()
  async getAllPlans(@Query() query: GetPlansQueryDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.plansService.getAllPlans(query, request);
    response.status(status).json(restOfResponse);
  }

  /**
   * Get a single plan by slug (e.g. for checkout).
   * @param slug - Plan slug
   * @param request - API request (language, etc.)
   * @param response - Express response for status and body
   * @returns Response sent via response (plan or 404)
   */
  @Get(':slug')
  async getPlanBySlug(@Param('slug') slug: string, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.plansService.getPlanBySlug(slug, request);
    response.status(status).json(restOfResponse);
  }
}

