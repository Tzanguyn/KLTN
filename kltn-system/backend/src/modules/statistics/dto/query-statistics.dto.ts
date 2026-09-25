import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryStatisticsDto {
  @ApiPropertyOptional({ description: 'ID học kỳ / đợt KLTN (nếu để trống sẽ tự động lấy đợt đang mở)' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;
}

