import { Module } from '@nestjs/common';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { WhatsAppWebhookValidator } from './whatsapp-webhook.validator';
import { RepositoriesModule } from '../../../repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  controllers: [WhatsAppWebhookController],
  providers: [WhatsAppWebhookService, WhatsAppWebhookValidator],
})
export class WhatsAppWebhookModule {}
