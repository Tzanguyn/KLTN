import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RejectTopicDto {
  @ApiProperty({
    example: 'Nội dung đề tài chưa phù hợp với định hướng bộ môn',
    description: 'Lý do từ chối đề tài',
    required: true,
  })
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống' })
  @IsString({ message: 'Lý do từ chối phải là chuỗi ký tự' })
  lyDo!: string;

  @ApiProperty({
    example: 'Nội dung đề tài chưa phù hợp với định hướng bộ môn',
    description: 'Lý do từ chối đề tài (alias)',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    example: 'Ghi chú thêm nếu có',
    description: 'Ghi chú bổ sung',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

