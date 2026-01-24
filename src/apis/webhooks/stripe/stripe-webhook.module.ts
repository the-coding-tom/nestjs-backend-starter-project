import { Module } from '@nestjs/common';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeWebhookValidator } from './stripe-webhook.validator';
import { RepositoriesModule } from '../../../repositories/repositories.module';
import { QueueProducersModule } from '../../../queues/queue-producers.module';

@Module({
  imports: [RepositoriesModule, QueueProducersModule],
  controllers: [StripeWebhookController],
  providers: [StripeWebhookService, StripeWebhookValidator],
})
export class StripeWebhookModule { }

