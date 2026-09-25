import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentMode, AppointmentStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ description: 'Tiêu đề cuộc hẹn' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Nội dung chi tiết cuộc hẹn' })
  @IsOptional()
  @IsString()
  noiDung?: string;

  @ApiPropertyOptional({ description: 'Mô tả thêm' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: AppointmentMode, description: 'Hình thức họp' })
  @IsOptional()
  @IsEnum(AppointmentMode)
  mode?: AppointmentMode;

  @ApiPropertyOptional({ description: 'Hình thức họp tiếng Việt: ONLINE | OFFLINE' })
  @IsOptional()
  @IsString()
  hinhThuc?: 'ONLINE' | 'OFFLINE';

  @ApiPropertyOptional({ description: 'Địa điểm họp (offline)' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Phòng họp (offline)' })
  @IsOptional()
  @IsString()
  phong?: string;

  @ApiPropertyOptional({ description: 'Link họp (online)' })
  @IsOptional()
  @IsString()
  meetingUrl?: string;

  @ApiPropertyOptional({ description: 'Link Google Meet (online)' })
  @IsOptional()
  @IsString()
  linkMeet?: string;

  @ApiPropertyOptional({ description: 'Thời gian bắt đầu (ISO string)' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'Thời gian bắt đầu (tiếng Việt)' })
  @IsOptional()
  @IsDateString()
  thoiGianBatDau?: string;

  @ApiPropertyOptional({ description: 'Thời gian kết thúc (ISO string)' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Thời gian kết thúc (tiếng Việt)' })
  @IsOptional()
  @IsDateString()
  thoiGianKetThuc?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus, description: 'Trạng thái cuộc hẹn' })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ description: 'Cho phép đề xuất lại thời gian' })
  @IsOptional()
  @IsBoolean()
  allowProposeTime?: boolean;

  @ApiPropertyOptional({ description: 'ID khách mời' })
  @IsOptional()
  @IsUUID()
  guestId?: string;
}

