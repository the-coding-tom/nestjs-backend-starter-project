import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsValidator } from './notifications.validator';
import { RepositoriesModule } from '../../repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsValidator],
  exports: [NotificationsService],
})
export class NotificationsModule {}

