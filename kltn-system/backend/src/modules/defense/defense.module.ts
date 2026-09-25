import { Module } from '@nestjs/common';
import { DefenseController } from './defense.controller';
import { ReviewAssignmentsController } from './review-assignments.controller';
import { DefenseCommitteesController } from './defense-committees.controller';
import { DefenseSchedulesController } from './defense-schedules.controller';
import { DefenseService } from './defense.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    DefenseController,
    ReviewAssignmentsController,
    DefenseCommitteesController,
    DefenseSchedulesController,
  ],
  providers: [DefenseService],
  exports: [DefenseService],
})
export class DefenseModule {}
