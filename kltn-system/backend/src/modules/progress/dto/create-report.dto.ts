import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ReportType } from '@prisma/client';
export class CreateReportDto { @IsUUID() groupId!: string; @IsUUID() semesterId!: string; @IsString() @MinLength(3) title!: string; @IsEnum(ReportType) reportType!: ReportType; @IsOptional() @IsString() content?: string; }
