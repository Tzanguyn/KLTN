import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveTopicDto {
  @ApiProperty({
    example: 'Đề tài đạt yêu cầu chất lượng chuyên môn',
    description: 'Ghi chú hoặc nhận xét khi phê duyệt đề tài',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    example: 'Đề tài đạt yêu cầu chất lượng chuyên môn',
    description: 'Ghi chú (alias)',
    required: false,
  })
  @IsOptional()
  @IsString()
  ghiChu?: string;
}

