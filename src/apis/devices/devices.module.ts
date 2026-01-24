import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DevicesValidator } from './devices.validator';
import { RepositoriesModule } from '../../repositories/repositories.module';

@Module({
  imports: [RepositoriesModule],
  controllers: [DevicesController],
  providers: [DevicesService, DevicesValidator],
  exports: [DevicesService],
})
export class DevicesModule {}

