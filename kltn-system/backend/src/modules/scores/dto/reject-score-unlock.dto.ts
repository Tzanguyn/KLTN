import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectScoreUnlockDto {
  @ApiProperty({
    description: 'Lý do từ chối yêu cầu mở khóa sửa điểm',
    example: 'Không đủ căn cứ điều chỉnh hoặc đã quá hạn theo quy chế.',
  })
  @IsNotEmpty({ message: 'Vui lòng cung cấp lý do từ chối' })
  @IsString({ message: 'Lý do từ chối phải là chuỗi ký tự' })
  lyDo!: string;
}

