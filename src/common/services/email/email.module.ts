import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { QueueProducersModule } from '../../../queues/queue-producers.module';

@Module({
  imports: [QueueProducersModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
