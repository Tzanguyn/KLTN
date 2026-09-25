import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class SetRegistrationPeriodDto {
  @ApiPropertyOptional({
    description: 'Thời gian bắt đầu mở đăng ký đề tài (ISO string, vd: 2026-10-01T00:00:00.000Z)',
    example: '2026-10-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  start?: string;

  @ApiPropertyOptional({
    description: 'Thời gian đóng / hết hạn đăng ký đề tài (ISO string, vd: 2026-10-31T23:59:59.000Z)',
    example: '2026-10-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  end?: string;

  @ApiPropertyOptional({
    description: 'Thời gian bắt đầu mở đăng ký (chuẩn tiếng Việt, ISO string)',
  })
  @IsOptional()
  @IsDateString()
  thoiGianBatDau?: string;

  @ApiPropertyOptional({
    description: 'Thời gian kết thúc đăng ký (chuẩn tiếng Việt, ISO string)',
  })
  @IsOptional()
  @IsDateString()
  thoiGianKetThuc?: string;
}

