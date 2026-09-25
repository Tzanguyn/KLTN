import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRegistrationDto {
  @ApiPropertyOptional({ description: 'ID học kỳ (tùy chọn, tự suy luận từ đề tài)' })
  @IsOptional()
  @IsString()
  semesterId?: string;

  @ApiPropertyOptional({ description: 'ID đề tài đăng ký' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ description: 'Nội dung đề xuất riêng (nếu có)' })
  @IsOptional()
  @IsString()
  proposal?: string;
}

