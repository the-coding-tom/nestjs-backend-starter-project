import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PlanRepository } from '../../repositories/plan.repository';
import { getStripe } from '../../common/services/stripe/helpers/stripe-client.helper';
import { plansData } from './data/plans.data';
import { CreatePlanData } from '../../repositories/entities/plan.entity';

@Injectable()
export class PlansSeederService {
  constructor(private readonly planRepository: PlanRepository) {}

  async seedPlans() {
    console.log('🌱 Seeding plans...');

    for (const planData of plansData) {
      const existingPlan = await this.planRepository.findBySlug(planData.slug);

      if (existingPlan) {
        console.log(`   ⏭️  Plan "${planData.slug}" already exists, skipping...`);
        continue;
      }

      const { monthlyPriceId, yearlyPriceId } = await this.syncPlanToStripe(
        planData.slug,
        planData.displayName,
        {
          monthlyPrice: planData.monthlyPrice,
          yearlyPrice: planData.yearlyPrice,
          description: planData.description,
        },
      );

      const createPlanData: CreatePlanData = {
        ...planData,
        stripeMonthlyPriceId: monthlyPriceId,
        stripeYearlyPriceId: yearlyPriceId,
      };

      await this.planRepository.create(createPlanData);

      console.log(`   ✅ Created plan: ${planData.displayName}`);
    }

    console.log('✅ Plans seeded successfully');
  }

  private async syncPlanToStripe(
    planSlug: string,
    planDisplayName: string,
    planData: {
      monthlyPrice: number;
      yearlyPrice: number;
      description?: string;
    },
  ): Promise<{
    monthlyPriceId: string | null;
    yearlyPriceId: string | null;
  }> {
    if (planData.monthlyPrice === 0 && planData.yearlyPrice === 0) {
      return { monthlyPriceId: null, yearlyPriceId: null };
    }

    const productExternalId = `app-${planSlug}`;

    const product = await this.findOrCreateProduct({
      externalId: productExternalId,
      name: planDisplayName,
      description: planData.description,
    });

    let monthlyPriceId: string | null = null;
    if (planData.monthlyPrice > 0) {
      const monthlyPrice = await this.findOrCreatePrice({
        externalId: `${productExternalId}-monthly`,
        productId: product.id,
        unitAmount: Math.round(planData.monthlyPrice * 100),
        interval: 'month',
        nickname: `${planDisplayName} - Monthly`,
      });
      monthlyPriceId = monthlyPrice.id;
    }

    let yearlyPriceId: string | null = null;
    if (planData.yearlyPrice > 0) {
      const yearlyPrice = await this.findOrCreatePrice({
        externalId: `${productExternalId}-yearly`,
        productId: product.id,
        unitAmount: Math.round(planData.yearlyPrice * 100),
        interval: 'year',
        nickname: `${planDisplayName} - Yearly`,
      });
      yearlyPriceId = yearlyPrice.id;
    }

    return { monthlyPriceId, yearlyPriceId };
  }

  private async findOrCreateProduct(params: {
    externalId: string;
    name: string;
    description?: string;
  }): Promise<Stripe.Product> {
    const stripe = getStripe();
    const existingProducts = await stripe.products.search({
      query: `metadata['externalId']:'${params.externalId}'`,
      limit: 1,
    });

    if (existingProducts.data.length > 0) {
      return existingProducts.data[0];
    }

    return await stripe.products.create({
      name: params.name,
      description: params.description,
      metadata: {
        externalId: params.externalId,
      },
    });
  }

  private async findOrCreatePrice(params: {
    externalId: string;
    productId: string;
    unitAmount: number;
    currency?: string;
    interval: 'month' | 'year';
    nickname?: string;
  }): Promise<Stripe.Price> {
    const stripe = getStripe();
    const existingPrices = await stripe.prices.search({
      query: `metadata['externalId']:'${params.externalId}'`,
      limit: 1,
    });

    if (existingPrices.data.length > 0) {
      return existingPrices.data[0];
    }

    return await stripe.prices.create({
      product: params.productId,
      unit_amount: params.unitAmount,
      currency: params.currency || 'usd',
      recurring: {
        interval: params.interval,
      },
      nickname: params.nickname,
      metadata: {
        externalId: params.externalId,
      },
    });
  }
}
