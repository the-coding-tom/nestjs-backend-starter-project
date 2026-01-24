import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { QueueProducersModule } from '../../../queues/queue-producers.module';

@Module({
  imports: [QueueProducersModule],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
