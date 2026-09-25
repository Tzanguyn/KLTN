import { Module } from '@nestjs/common';
import { ScoresController } from './scores.controller';
import { ScoringFormsController } from './scoring-forms.controller';
import { ScoreUnlockRequestsController } from './score-unlock-requests.controller';
import { ScoresService } from './scores.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ScoresController, ScoringFormsController, ScoreUnlockRequestsController],
  providers: [ScoresService],
  exports: [ScoresService],
})
export class ScoresModule {}
