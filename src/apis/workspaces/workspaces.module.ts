import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesValidator } from './workspaces.validator';
import { RepositoriesModule } from '../../repositories/repositories.module';
import { EmailModule } from '../../common/services/email/email.module';
import { InboxModule } from '../../common/services/inbox/inbox.module';

@Module({
  imports: [RepositoriesModule, EmailModule, InboxModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspacesValidator],
  exports: [WorkspacesService],
})
export class WorkspacesModule { }

