import Stripe from 'stripe';
import { config } from '../../../../config/config';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!config.stripe.secretKey) {
      throw new Error('Stripe secret key is not configured');
    }
    stripeClient = new Stripe(config.stripe.secretKey, {
      apiVersion: config.stripe.apiVersion as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return stripeClient;
}
