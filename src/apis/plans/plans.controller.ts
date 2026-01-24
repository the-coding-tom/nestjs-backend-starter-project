import { Controller, Get, Query, Param, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { PlansService } from './plans.service';
import { ApiRequest } from '../../common/types/request.types';
import { GetPlansQueryDto } from './dto/plans.dto';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  async getAllPlans(@Query() query: GetPlansQueryDto, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.plansService.getAllPlans(query, request);
    response.status(status).json(restOfResponse);
  }

  @Get(':slug')
  async getPlanBySlug(@Param('slug') slug: string, @Req() request: ApiRequest, @Res() response: Response) {
    const { status, ...restOfResponse } = await this.plansService.getPlanBySlug(slug, request);
    response.status(status).json(restOfResponse);
  }
}

