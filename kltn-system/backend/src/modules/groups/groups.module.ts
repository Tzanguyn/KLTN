import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/progress.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [ProgressModule],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
