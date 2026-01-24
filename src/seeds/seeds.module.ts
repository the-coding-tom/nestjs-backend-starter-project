import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { PlansSeederService } from './plans/plans-seeder.service';

@Module({
  imports: [RepositoriesModule],
  providers: [PlansSeederService],
  exports: [PlansSeederService],
})
export class SeedsModule {
  constructor(private readonly plansSeederService: PlansSeederService) {}

  onApplicationBootstrap() {
    // Register all seeders here
    this.plansSeederService.seedPlans();
  }
}

