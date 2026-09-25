import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class ApproveScoreUnlockDto {
  @ApiPropertyOptional({
    description: 'Thời hạn cho phép sửa điểm (ISO date string, ngày giờ cụ thể, hoặc số giờ tính từ thời điểm duyệt). Mặc định là 24 giờ nếu không truyền.',
    example: '2026-09-25T23:59:59.000Z',
  })
  @IsOptional()
  thoiHanChoPhepSua?: string | number | Date;
}

