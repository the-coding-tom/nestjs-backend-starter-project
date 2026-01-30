import { Injectable, HttpStatus } from '@nestjs/common';
import { generateSuccessResponse, generateErrorResponse } from '../../helpers/response.helper';
import { LoggerService } from '../../common/services/logger/logger.service';
import { PlanRepository } from '../../repositories/plan.repository';
import { PlansValidator } from './plans.validator';
import { GetPlansQueryDto } from './dto/plans.dto';
import { translate } from '../../helpers/i18n.helper';
import { ApiRequest } from '../../common/types/request.types';
import { I18nService } from 'nestjs-i18n';

/**
 * Serves plan catalog (pricing, features) for subscription checkout and display.
 */
@Injectable()
export class PlansService {
  constructor(
    private readonly planRepository: PlanRepository,
    private readonly plansValidator: PlansValidator,
    private readonly i18n: I18nService,
  ) {}

  /**
   * List plans with optional filters.
   * @param query - Optional filters (e.g. slug, active)
   * @param request - API request (language, etc.)
   * @returns Success response with plans array or error response
   */
  async getAllPlans(query: GetPlansQueryDto, request: ApiRequest): Promise<any> {
    try {
      const { filters } = await this.plansValidator.validateGetPlansQuery({
        ...query,
        language: request.language,
      });

      const plans = await this.planRepository.findAll(filters);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'plans.retrieved', request.language),
        data: plans,
      });
    } catch (error) {
      LoggerService.error(`Error fetching plans: ${error}`);
      return generateErrorResponse(error);
    }
  }

  /**
   * Get plan by slug for checkout or display.
   * @param slug - Plan slug
   * @param request - API request (language, etc.)
   * @returns Success response with plan or error response
   */
  async getPlanBySlug(slug: string, request: ApiRequest): Promise<any> {
    try {
      const { plan } = await this.plansValidator.validateGetPlanBySlug(slug, request.language);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'plans.retrieved', request.language),
        data: plan,
      });
    } catch (error) {
      LoggerService.error(`Error fetching plan: ${error}`);
      return generateErrorResponse(error);
    }
  }
}

