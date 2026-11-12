import { Module } from '@nestjs/common';
import { DefenseController } from './defense.controller';
import { ReviewAssignmentsController } from './review-assignments.controller';
import { DefenseCommitteesController } from './defense-committees.controller';
import { DefenseSchedulesController } from './defense-schedules.controller';
import { DefenseAiController } from './defense-ai.controller';
import { DefenseService } from './defense.service';
import { DefenseAiService } from './defense-ai.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    DefenseController,
    ReviewAssignmentsController,
    DefenseCommitteesController,
    DefenseSchedulesController,
    DefenseAiController,
  ],
  providers: [DefenseService, DefenseAiService],
  exports: [DefenseService, DefenseAiService],
})
export class DefenseModule {}
