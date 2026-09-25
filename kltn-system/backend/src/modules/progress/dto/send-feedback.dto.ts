import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendFeedbackDto {
  @ApiProperty({ description: 'Nội dung phản hồi / nhận xét của giảng viên' })
  @IsNotEmpty({ message: 'Nội dung phản hồi không được để trống' })
  @IsString({ message: 'Nội dung phản hồi phải là chuỗi ký tự' })
  content!: string;

  @ApiPropertyOptional({
    description:
      'Đánh dấu yêu cầu sinh viên chỉnh sửa lại (true: REVISION_REQUIRED, false: ACCEPTED, undefined: UNDER_REVIEW)',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'yeuCauChinhSua phải là kiểu boolean' })
  yeuCauChinhSua?: boolean;
}
