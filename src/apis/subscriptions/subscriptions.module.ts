import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsValidator } from './subscriptions.validator';
import { RepositoriesModule } from '../../repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsValidator],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule { }

