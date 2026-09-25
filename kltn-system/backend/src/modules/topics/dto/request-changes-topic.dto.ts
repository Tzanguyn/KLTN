import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RequestChangesTopicDto {
  @ApiProperty({
    example: 'Cần làm rõ thêm mục tiêu nghiên cứu và công nghệ sử dụng',
    description: 'Nội dung / lý do yêu cầu chỉnh sửa đề tài',
    required: true,
  })
  @IsNotEmpty({ message: 'Nội dung yêu cầu chỉnh sửa không được để trống' })
  @IsString({ message: 'Nội dung yêu cầu chỉnh sửa phải là chuỗi ký tự' })
  lyDo!: string;

  @ApiProperty({
    example: 'Cần làm rõ thêm mục tiêu nghiên cứu',
    description: 'Nội dung yêu cầu chỉnh sửa (alias)',
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

