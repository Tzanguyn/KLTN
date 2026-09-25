import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentMode } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiPropertyOptional({ description: 'ID của nhóm KLTN (nếu đặt lịch theo nhóm)' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({
    description: 'Danh sách ID sinh viên (userId hoặc studentId) nếu đặt lịch theo sinh viên',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  studentIds?: string[];

  @ApiPropertyOptional({ description: 'ID khách mời cụ thể (tùy chọn)' })
  @IsOptional()
  @IsUUID()
  guestId?: string;

  @ApiPropertyOptional({ description: 'Tiêu đề cuộc hẹn' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Nội dung chi tiết cuộc hẹn (hoặc tiêu đề ngắn gọn)' })
  @IsOptional()
  @IsString()
  noiDung?: string;

  @ApiPropertyOptional({ description: 'Mô tả thêm về cuộc hẹn' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Hình thức họp (chuẩn tiếng Anh): ONLINE | OFFLINE',
    enum: AppointmentMode,
  })
  @IsOptional()
  @IsEnum(AppointmentMode)
  mode?: AppointmentMode;

  @ApiPropertyOptional({
    description: 'Hình thức họp (chuẩn tiếng Việt): ONLINE | OFFLINE',
    example: 'ONLINE',
  })
  @IsOptional()
  @IsString()
  hinhThuc?: 'ONLINE' | 'OFFLINE';

  @ApiPropertyOptional({ description: 'Địa điểm họp (offline)' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Phòng họp trực tiếp (offline)' })
  @IsOptional()
  @IsString()
  phong?: string;

  @ApiPropertyOptional({ description: 'Đường link họp trực tuyến (Google Meet/Zoom)' })
  @IsOptional()
  @IsString()
  meetingUrl?: string;

  @ApiPropertyOptional({ description: 'Đường link Google Meet họp trực tuyến' })
  @IsOptional()
  @IsString()
  linkMeet?: string;

  @ApiPropertyOptional({ description: 'Thời gian bắt đầu (ISO string)' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'Thời gian bắt đầu (chuẩn tiếng Việt, ISO string)' })
  @IsOptional()
  @IsDateString()
  thoiGianBatDau?: string;

  @ApiPropertyOptional({ description: 'Thời gian kết thúc (ISO string)' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ description: 'Thời gian kết thúc (chuẩn tiếng Việt, ISO string)' })
  @IsOptional()
  @IsDateString()
  thoiGianKetThuc?: string;

  @ApiPropertyOptional({
    description: 'Cho phép sinh viên đề xuất lại thời gian khác nếu bận',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  allowProposeTime?: boolean;
}
