import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { QueueProducersModule } from '../../../queues/queue-producers.module';
import { RepositoriesModule } from '../../../repositories/repositories.module';

@Module({
  imports: [QueueProducersModule, RepositoriesModule],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
