import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ApproveEvidenceDto {
  @ApiPropertyOptional({
    description: 'Điểm thưởng NCKH cộng thêm (nếu không truyền sẽ tự động tính theo quy định cấu hình, tối đa 2.0)',
    example: 2.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  points?: number;

  @ApiPropertyOptional({
    description: 'Ghi chú phê duyệt của Trưởng bộ môn',
    example: 'Đạt chuẩn bài báo quốc tế IEEE',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

