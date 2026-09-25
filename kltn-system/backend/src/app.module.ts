import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TopicsModule } from './modules/topics/topics.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { ProgressModule } from './modules/progress/progress.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ScoresModule } from './modules/scores/scores.module';
import { DefenseModule } from './modules/defense/defense.module';
import { ConfigModule as SystemConfigModule } from './modules/config/config.module';
import { UsersModule } from './modules/users/users.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ChatModule } from './modules/chat/chat.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { GroupsModule } from './modules/groups/groups.module';
import { AuditModule } from './modules/audit/audit.module';
import { TopicProposalsModule } from './modules/topic-proposals/topic-proposals.module';
import { MidtermEvaluationsModule } from './modules/midterm-evaluations/midterm-evaluations.module';
import { QuotasModule } from './modules/quotas/quotas.module';
import { SemestersModule } from './modules/semesters/semesters.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    DashboardModule,
    StatisticsModule,
    SemestersModule,
    QuotasModule,
    MidtermEvaluationsModule,
    TopicProposalsModule,
    ConfigModule.forRoot({ isGlobal: true, validationSchema: Joi.object({ DATABASE_URL: Joi.string().required(), PORT: Joi.number().default(3000), CORS_ORIGIN: Joi.string().required(), JWT_ACCESS_SECRET: Joi.string().min(32).required(), JWT_REFRESH_SECRET: Joi.string().min(32).required() }) }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ReportsModule,
    ChatModule,
    EvidenceModule,
    GroupsModule,
    AuditModule,
    TopicsModule,
    RegistrationsModule,
    ProgressModule,
    AppointmentsModule,
    NotificationsModule,
    ScoresModule,
    DefenseModule,
    SystemConfigModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
