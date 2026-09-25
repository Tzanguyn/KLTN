import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TopicProposalsController } from './topic-proposals.controller';
import { TopicProposalsService } from './topic-proposals.service';
import { SemestersModule } from '../semesters/semesters.module';

@Module({
  imports: [NotificationsModule, SemestersModule],
  controllers: [TopicProposalsController],
  providers: [TopicProposalsService],
  exports: [TopicProposalsService],
})
export class TopicProposalsModule {}

