import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ScoresModule } from '../scores/scores.module';

@Module({ controllers: [ReportsController], providers: [ReportsService] })
@Module({
  imports: [ScoresModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
