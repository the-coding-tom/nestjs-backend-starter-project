import { Module } from '@nestjs/common';
import { BrevoWebhookController } from './brevo-webhook.controller';
import { BrevoWebhookService } from './brevo-webhook.service';
import { BrevoWebhookValidator } from './brevo-webhook.validator';
import { RepositoriesModule } from '../../../repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  controllers: [BrevoWebhookController],
  providers: [BrevoWebhookService, BrevoWebhookValidator],
})
export class BrevoWebhookModule {}
