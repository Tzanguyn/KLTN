import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RequestMoreInfoEvidenceDto {
  @ApiPropertyOptional({
    description: 'Yêu cầu hoặc hướng dẫn chi tiết sinh viên cần bổ sung tài liệu minh chứng gì',
    example: 'Vui lòng bổ sung giấy xác nhận đăng bài từ ban biên tập hoặc link bài báo',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Lý do yêu cầu bổ sung (alias của note)',
    example: 'Thiếu minh chứng công bố',
  })
  @IsOptional()
  @IsString()
  lyDo?: string;
}

