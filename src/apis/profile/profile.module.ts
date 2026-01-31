import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProfileValidator } from './profile.validator';
import { RepositoriesModule } from '../../repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileValidator],
  exports: [ProfileService],
})
export class ProfileModule {}
