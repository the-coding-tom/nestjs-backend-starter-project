import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PlanRepository } from '../../repositories/plan.repository';
import { throwError } from '../../helpers/response.helper';
import { ErrorCode } from '../../common/enums/generic.enum';
import { translate } from '../../helpers/i18n.helper';
import { validateJoiSchema } from '../../utils/joi.util';
import { PlanType } from '@prisma/client';
import { GetPlansQueryDto } from './dto/plans.dto';
import * as Joi from 'joi';

@Injectable()
export class PlansValidator {
  constructor(
    private readonly planRepository: PlanRepository,
    private readonly i18n: I18nService,
  ) {}

  async validateGetPlansQuery(data: GetPlansQueryDto & { language: string }): Promise<{ dto: GetPlansQueryDto; filters: { planType?: PlanType; isActive?: boolean } }> {
    const schema = Joi.object({
      planType: Joi.string().valid('FREE', 'PAID').optional().messages({
        'any.only': translate(this.i18n, 'validation.planTypeInvalid', data.language),
      }),
      isActive: Joi.boolean().optional(),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const filters: { planType?: PlanType; isActive?: boolean } = {};
    if (data.planType) {
      filters.planType = data.planType as PlanType;
    }
    if (data.isActive !== undefined) {
      filters.isActive = data.isActive;
    }

    return { dto: data, filters };
  }

  async validateGetPlanBySlug(slug: string, language: string): Promise<{ plan: any }> {
    // Validate slug format
    const schema = Joi.object({
      slug: Joi.string()
        .pattern(/^[a-z0-9-]+$/)
        .min(1)
        .max(100)
        .required()
        .messages({
          'string.pattern.base': translate(this.i18n, 'validation.slug.invalid', language) || 'Slug must contain only lowercase letters, numbers, and hyphens',
          'any.required': translate(this.i18n, 'validation.slug.required', language) || 'Slug is required',
        }),
    });

    const error = validateJoiSchema(schema, { slug });
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const plan = await this.planRepository.findBySlug(slug);

    if (!plan) {
      throwError(translate(this.i18n, 'errors.planNotFound', language), HttpStatus.NOT_FOUND, ErrorCode.PLAN_NOT_FOUND);
    }

    return { plan };
  }

  async validateCreateOrUpdatePlan(
    data: any & { language: string; planType?: string; monthlyPrice?: number | null; yearlyPrice?: number | null },
  ): Promise<{ dto: any }> {
    const schema = Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(1).max(100).optional(),
      displayName: Joi.string().min(1).max(100).optional(),
      description: Joi.string().allow(null, '').optional(),
      planType: Joi.string().valid('FREE', 'PAID').optional().messages({
        'any.only': translate(this.i18n, 'validation.planTypeInvalid', data.language),
      }),
      monthlyPrice: Joi.number()
        .min(0)
        .allow(null)
        .when('planType', {
          is: 'FREE',
          then: Joi.number().valid(0).allow(null).messages({
            'any.only': translate(this.i18n, 'validation.price.freeMustBeZero', data.language) || 'FREE plans must have price = 0',
          }),
          otherwise: Joi.number().allow(null),
        }),
      yearlyPrice: Joi.number()
        .min(0)
        .allow(null)
        .when('planType', {
          is: 'FREE',
          then: Joi.number().valid(0).allow(null).messages({
            'any.only': translate(this.i18n, 'validation.price.freeMustBeZero', data.language) || 'FREE plans must have price = 0',
          }),
          otherwise: Joi.number().allow(null),
        }),
      language: Joi.string().required(),
    })
      .custom((value, helpers) => {
        // Root-level validation: PAID plans must have at least one price > 0
        if (value.planType === 'PAID') {
          const monthly = value.monthlyPrice ?? 0;
          const yearly = value.yearlyPrice ?? 0;
          if (monthly <= 0 && yearly <= 0) {
            return helpers.error('any.custom', {
              message:
                translate(this.i18n, 'validation.price.paidMustHavePrice', data.language) ||
                'PAID plans must have at least one price greater than 0',
            });
          }
        }
        return value;
      })
      .messages({
        'any.custom': translate(this.i18n, 'validation.price.paidMustHavePrice', data.language) || 'PAID plans must have at least one price greater than 0',
      });

    const error = validateJoiSchema(schema, data);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    return { dto: data };
  }
}

