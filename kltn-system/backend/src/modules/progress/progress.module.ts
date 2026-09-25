import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProgressController } from './progress.controller';
import { SubmissionsController } from './submissions.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ProgressController, SubmissionsController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}

