import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { SystemConfigService } from './config.service';
import { SemestersModule } from '../semesters/semesters.module';

@Module({
  imports: [SemestersModule],
  controllers: [ConfigController],
  providers: [SystemConfigService],
})
export class ConfigModule {}

