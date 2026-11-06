import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum SystemOperationalMode {
  OPEN = 'OPEN',
  MAINTENANCE = 'MAINTENANCE',
  READ_ONLY = 'READ_ONLY',
}

export class UpdateSystemStatusDto {
  @ApiProperty({ enum: SystemOperationalMode, example: SystemOperationalMode.OPEN })
  @IsEnum(SystemOperationalMode, { message: 'Trạng thái hoạt động không hợp lệ' })
  status!: SystemOperationalMode;

  @ApiPropertyOptional({ example: 'Hệ thống đang bảo trì dữ liệu học kỳ...' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ example: '2026-10-10T23:59:59Z' })
  @IsOptional()
  @IsString()
  maintenanceUntil?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowAdminOnly?: boolean;

  @ApiPropertyOptional({ example: '2026-10-07T16:18:22.000Z' })
  @IsOptional()
  @IsString()
  updatedAt?: string;
}
