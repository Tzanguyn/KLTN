import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MidtermEvaluationsController } from './midterm-evaluations.controller';
import { MidtermEvaluationsService } from './midterm-evaluations.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MidtermEvaluationsController],
  providers: [MidtermEvaluationsService],
  exports: [MidtermEvaluationsService],
})
export class MidtermEvaluationsModule {}

