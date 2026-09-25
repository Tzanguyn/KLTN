import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectEvidenceDto {
  @ApiProperty({
    description: 'Lý do từ chối minh chứng NCKH',
    example: 'Minh chứng không đủ căn cứ hoặc không thuộc danh mục được công nhận',
  })
  @IsNotEmpty({ message: 'Vui lòng cung cấp lý do từ chối' })
  @IsString({ message: 'Lý do từ chối phải là chuỗi ký tự' })
  lyDo!: string;
}

