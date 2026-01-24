import { Injectable, HttpStatus } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { generateSuccessResponse, generateErrorResponse } from '../../helpers/response.helper';
import { LoggerService } from '../../common/services/logger/logger.service';
import { SubscriptionRepository } from '../../repositories/subscription.repository';
import { StripeCheckoutSessionRepository } from '../../repositories/stripe-checkout-session.repository';
import { SubscriptionsValidator } from './subscriptions.validator';
import {
  CreateCheckoutSessionDto,
  ChangePlanDto,
} from './dto/subscriptions.dto';
import {
  createCheckoutSession,
  createPortalSession,
  changePlan as changeStripePlan,
  cancelSubscription as cancelStripeSubscription,
  listInvoices as listStripeInvoices,
} from '../../common/services/stripe/stripe.service';
import { config } from '../../config/config';
import { translate } from '../../helpers/i18n.helper';
import { ApiRequest } from '../../common/types/request.types';
import { BillingInterval, SubscriptionStatus } from '@prisma/client';
import { UpdateSubscriptionData } from '../../repositories/entities/subscription.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly stripeCheckoutSessionRepository: StripeCheckoutSessionRepository,
    private readonly subscriptionsValidator: SubscriptionsValidator,
    private readonly i18n: I18nService,
  ) {}

  async getSubscription(userId: number, request: ApiRequest): Promise<any> {
    try {
      const { subscription } = await this.subscriptionsValidator.validateGetSubscription(
        userId,
        request.language,
      );

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'subscriptions.retrieved', request.language),
        data: subscription,
      });
    } catch (error) {
      LoggerService.error(`Error fetching subscription: ${error}`);
      return generateErrorResponse(error);
    }
  }

  async createCheckoutSession(
    userId: number,
    dto: CreateCheckoutSessionDto,
    userEmail: string,
    request: ApiRequest,
  ): Promise<any> {
    try {
      const { dto: validatedDto, plan, priceId } =
        await this.subscriptionsValidator.validateCreateCheckoutSession({ ...dto, language: request.language });

      const session = await createCheckoutSession({
        customerEmail: userEmail,
        stripePriceId: priceId,
        metadata: {
          userId: userId.toString(),
          planSlug: plan.slug,
          billingInterval: validatedDto.billingInterval,
        },
        successUrl: validatedDto.successUrl,
        cancelUrl: validatedDto.cancelUrl,
      });

      // Save checkout session to database with PENDING status
      await this.stripeCheckoutSessionRepository.create({
        stripeSessionId: session.id,
        userId,
        planId: plan.id,
        billingInterval: validatedDto.billingInterval === 'YEARLY'
          ? BillingInterval.YEARLY
          : BillingInterval.MONTHLY,
      });

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'subscriptions.checkoutCreated', request.language),
        data: {
          checkoutUrl: session.url,
          selectedPlan: plan.displayName,
          billingInterval: validatedDto.billingInterval,
        },
      });
    } catch (error) {
      LoggerService.error(`Error creating checkout session: ${error}`);
      return generateErrorResponse(error);
    }
  }

  async changePlan(
    userId: number,
    dto: ChangePlanDto,
    request: ApiRequest,
  ): Promise<any> {
    try {
      const { subscription, newPlan, isUpgrade, priceId } =
        await this.subscriptionsValidator.validateChangePlan({ ...dto, language: request.language }, userId);

      await changeStripePlan(subscription.stripeSubscriptionId, priceId, isUpgrade);

      const message = isUpgrade
        ? translate(this.i18n, 'subscriptions.planUpgraded', request.language)
        : translate(this.i18n, 'subscriptions.planDowngraded', request.language);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message,
        data: {
          status: 'pending_invoice',
          changeType: isUpgrade ? 'upgrade' : 'downgrade',
          from: {
            plan: subscription.Plan.displayName,
          },
          to: {
            plan: newPlan.displayName,
          },
          prorationApplied: isUpgrade,
        },
      });
    } catch (error) {
      LoggerService.error(`Error changing subscription plan: ${error}`);
      return generateErrorResponse(error);
    }
  }

  async cancelSubscription(userId: number, request: ApiRequest): Promise<any> {
    try {
      const { subscription } = await this.subscriptionsValidator.validateCancelSubscription(
        userId,
        request.language,
      );

      await cancelStripeSubscription(subscription.stripeSubscriptionId);

      const updateData: UpdateSubscriptionData = {
        cancelAtPeriodEnd: true,
        canceledAt: null,
        status: SubscriptionStatus.ACTIVE,
      };
      await this.subscriptionRepository.update(subscription.id, updateData);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'subscriptions.canceled', request.language),
        data: {
          status: 'active',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      });
    } catch (error) {
      LoggerService.error(`Error cancelling subscription: ${error}`);
      return generateErrorResponse(error);
    }
  }

  async getPortalSession(userId: number, request: ApiRequest): Promise<any> {
    try {
      const { subscription } = await this.subscriptionsValidator.validateGetPortalSession(
        userId,
        request.language,
      );

      const session = await createPortalSession(
        subscription.stripeCustomerId,
        `${config.frontendUrl}/billing`,
      );

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'subscriptions.portalCreated', request.language),
        data: {
          url: session.url,
        },
      });
    } catch (error) {
      LoggerService.error(`Error creating portal session: ${error}`);
      return generateErrorResponse(error);
    }
  }

  async getInvoices(userId: number, request: ApiRequest): Promise<any> {
    try {
      const { subscription } = await this.subscriptionsValidator.validateGetInvoices(
        userId,
        request.language,
      );

      const invoices = await listStripeInvoices(subscription.stripeCustomerId, 10);

      const formattedInvoices = invoices.map((invoice) => ({
        id: invoice.id,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        created: invoice.created,
        invoice_pdf: invoice.invoice_pdf,
        hosted_invoice_url: invoice.hosted_invoice_url,
      }));

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'subscriptions.invoicesRetrieved', request.language),
        data: formattedInvoices,
      });
    } catch (error) {
      LoggerService.error(`Error fetching invoices: ${error}`);
      return generateErrorResponse(error);
    }
  }

  async getSubscriptionHistory(userId: number, request: ApiRequest): Promise<any> {
    try {
      const { subscription } = await this.subscriptionsValidator.validateGetSubscriptionHistory(
        userId,
        request.language,
      );

      const history = await this.subscriptionRepository.findHistoryBySubscriptionId(subscription.id);

      return generateSuccessResponse({
        statusCode: HttpStatus.OK,
        message: translate(this.i18n, 'subscriptions.historyRetrieved', request.language),
        data: history,
      });
    } catch (error) {
      LoggerService.error(`Error fetching subscription history: ${error}`);
      return generateErrorResponse(error);
    }
  }
}

