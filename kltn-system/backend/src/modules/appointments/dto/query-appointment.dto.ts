import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentMode, AppointmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryAppointmentDto {
  @ApiPropertyOptional({ enum: AppointmentStatus, description: 'Lọc theo trạng thái cuộc hẹn' })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ description: 'Thời gian bắt đầu từ (ISO string hoặc YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Alias của startDate: thời gian từ' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Thời gian kết thúc đến (ISO string hoặc YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Alias của endDate: thời gian đến' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ enum: AppointmentMode, description: 'Hình thức họp' })
  @IsOptional()
  @IsEnum(AppointmentMode)
  mode?: AppointmentMode;

  @ApiPropertyOptional({ description: 'Hình thức họp tiếng Việt' })
  @IsOptional()
  @IsString()
  hinhThuc?: 'ONLINE' | 'OFFLINE';

  @ApiPropertyOptional({ description: 'Lọc theo ID nhóm' })
  @IsOptional()
  @IsString()
  groupId?: string;
}

