import { Module } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { RepositoriesModule } from '../../../repositories/repositories.module';

@Module({
    imports: [RepositoriesModule],
    providers: [InboxService],
    exports: [InboxService],
})
export class InboxModule { }
