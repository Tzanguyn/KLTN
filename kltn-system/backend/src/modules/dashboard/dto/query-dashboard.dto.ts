import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryDashboardDto {
  @ApiPropertyOptional({ description: 'ID học kỳ (mặc định lấy đợt đang mở)' })
  @IsOptional()
  @IsString()
  semesterId?: string;

  @ApiPropertyOptional({ description: 'Tùy chọn vai trò muốn xem nếu user có nhiều vai trò' })
  @IsOptional()
  @IsString()
  role?: string;
}

