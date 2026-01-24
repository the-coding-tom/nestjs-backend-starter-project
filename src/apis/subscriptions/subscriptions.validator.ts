import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { SubscriptionRepository } from '../../repositories/subscription.repository';
import { PlanRepository } from '../../repositories/plan.repository';
import { throwError } from '../../helpers/response.helper';
import { ErrorCode } from '../../common/enums/generic.enum';
import { translate } from '../../helpers/i18n.helper';
import { validateJoiSchema } from '../../utils/joi.util';
import { SubscriptionStatus } from '@prisma/client';
import {
  CreateCheckoutSessionDto,
  ChangePlanDto,
} from './dto/subscriptions.dto';
import * as Joi from 'joi';

@Injectable()
export class SubscriptionsValidator {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planRepository: PlanRepository,
    private readonly i18n: I18nService,
  ) {}

  async validateGetSubscription(
    userId: number,
    language: string,
  ): Promise<{ subscription: any }> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);

    if (!subscription) {
      throwError(translate(this.i18n, 'errors.subscriptionNotFound', language), HttpStatus.NOT_FOUND, ErrorCode.SUBSCRIPTION_NOT_FOUND);
    }

    return { subscription };
  }

  async validateCreateCheckoutSession(
    dto: CreateCheckoutSessionDto & { language: string },
  ): Promise<{ dto: CreateCheckoutSessionDto; plan: any; priceId: string }> {
    const schema = Joi.object({
      planSlug: Joi.string().required().messages({
        'string.base': translate(this.i18n, 'validation.planSlugRequired', dto.language),
        'any.required': translate(this.i18n, 'validation.planSlugRequired', dto.language),
      }),
      billingInterval: Joi.string().valid('MONTHLY', 'YEARLY').required().messages({
        'string.base': translate(this.i18n, 'validation.billingIntervalInvalid', dto.language),
        'any.required': translate(this.i18n, 'validation.billingIntervalRequired', dto.language),
        'any.only': translate(this.i18n, 'validation.billingIntervalInvalid', dto.language),
      }),
      successUrl: Joi.string().uri().required().messages({
        'string.uri': translate(this.i18n, 'validation.url.invalid', dto.language),
        'any.required': translate(this.i18n, 'validation.url.required', dto.language),
      }),
      cancelUrl: Joi.string().uri().required().messages({
        'string.uri': translate(this.i18n, 'validation.url.invalid', dto.language),
        'any.required': translate(this.i18n, 'validation.url.required', dto.language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, dto);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const plan = await this.planRepository.findBySlug(dto.planSlug);

    if (!plan || !plan.isActive) {
      throwError(translate(this.i18n, 'errors.planNotFound', dto.language), HttpStatus.NOT_FOUND, ErrorCode.PLAN_NOT_FOUND);
    }

    const priceId =
      dto.billingInterval === 'MONTHLY'
        ? plan.stripeMonthlyPriceId
        : plan.stripeYearlyPriceId;

    if (!priceId) {
      throwError(translate(this.i18n, 'errors.priceNotAvailable', dto.language), HttpStatus.BAD_REQUEST, ErrorCode.PRICE_NOT_AVAILABLE);
    }

    return { dto, plan, priceId };
  }

  async validateChangePlan(
    dto: ChangePlanDto & { language: string },
    userId: number,
  ): Promise<{
    dto: ChangePlanDto;
    subscription: any;
    newPlan: any;
    isUpgrade: boolean;
    priceId: string;
  }> {
    const schema = Joi.object({
      planSlug: Joi.string().required().messages({
        'string.base': translate(this.i18n, 'validation.planSlugRequired', dto.language),
        'any.required': translate(this.i18n, 'validation.planSlugRequired', dto.language),
      }),
      billingInterval: Joi.string().valid('MONTHLY', 'YEARLY').required().messages({
        'string.base': translate(this.i18n, 'validation.billingIntervalInvalid', dto.language),
        'any.required': translate(this.i18n, 'validation.billingIntervalRequired', dto.language),
        'any.only': translate(this.i18n, 'validation.billingIntervalInvalid', dto.language),
      }),
      language: Joi.string().required(),
    });

    const error = validateJoiSchema(schema, dto);
    if (error) throwError(error, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);

    const subscription = await this.subscriptionRepository.findByUserId(userId);

    if (!subscription || !subscription.stripeSubscriptionId) {
      throwError(translate(this.i18n, 'errors.subscriptionNotFound', dto.language), HttpStatus.NOT_FOUND, ErrorCode.SUBSCRIPTION_NOT_FOUND);
    }

    const currentPlan = await this.planRepository.findById(subscription.planId);
    if (!currentPlan) {
      throwError(translate(this.i18n, 'errors.planNotFound', dto.language), HttpStatus.NOT_FOUND, ErrorCode.PLAN_NOT_FOUND);
    }

    const newPlan = await this.planRepository.findBySlug(dto.planSlug);
    if (!newPlan || !newPlan.isActive) {
      throwError(translate(this.i18n, 'errors.planNotFound', dto.language), HttpStatus.NOT_FOUND, ErrorCode.PLAN_NOT_FOUND);
    }

    const priceId =
      dto.billingInterval === 'MONTHLY'
        ? newPlan.stripeMonthlyPriceId
        : newPlan.stripeYearlyPriceId;

    if (!priceId) {
      throwError(translate(this.i18n, 'errors.priceNotAvailable', dto.language), HttpStatus.BAD_REQUEST, ErrorCode.PRICE_NOT_AVAILABLE);
    }

    // Determine if upgrade or downgrade based on plan display order
    const isUpgrade = newPlan.displayOrder > currentPlan.displayOrder;

    return { dto, subscription, newPlan, isUpgrade, priceId };
  }

  async validateCancelSubscription(
    userId: number,
    language: string,
  ): Promise<{ subscription: any }> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);

    if (!subscription || !subscription.stripeSubscriptionId) {
      throwError(translate(this.i18n, 'errors.subscriptionNotFound', language), HttpStatus.NOT_FOUND, ErrorCode.SUBSCRIPTION_NOT_FOUND);
    }

    if (subscription.status === SubscriptionStatus.CANCELED) {
      throwError(translate(this.i18n, 'errors.subscriptionAlreadyCanceled', language), HttpStatus.BAD_REQUEST, ErrorCode.SUBSCRIPTION_ALREADY_CANCELED);
    }

    return { subscription };
  }

  async validateGetPortalSession(
    userId: number,
    language: string,
  ): Promise<{ subscription: any }> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);

    if (!subscription || !subscription.stripeCustomerId) {
      throwError(translate(this.i18n, 'errors.subscriptionNotFound', language), HttpStatus.NOT_FOUND, ErrorCode.SUBSCRIPTION_NOT_FOUND);
    }

    return { subscription };
  }

  async validateGetInvoices(
    userId: number,
    language: string,
  ): Promise<{ subscription: any }> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);

    if (!subscription || !subscription.stripeCustomerId) {
      throwError(translate(this.i18n, 'errors.subscriptionNotFound', language), HttpStatus.NOT_FOUND, ErrorCode.SUBSCRIPTION_NOT_FOUND);
    }

    return { subscription };
  }

  async validateGetSubscriptionHistory(
    userId: number,
    language: string,
  ): Promise<{ subscription: any }> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);

    if (!subscription) {
      throwError(translate(this.i18n, 'errors.subscriptionNotFound', language), HttpStatus.NOT_FOUND, ErrorCode.SUBSCRIPTION_NOT_FOUND);
    }

    return { subscription };
  }
}

