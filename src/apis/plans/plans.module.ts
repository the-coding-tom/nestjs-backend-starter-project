import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PlansValidator } from './plans.validator';
import { RepositoriesModule } from '../../repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  controllers: [PlansController],
  providers: [PlansService, PlansValidator],
  exports: [PlansService],
})
export class PlansModule {}

