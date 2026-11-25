import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEvidenceDto {
  @ApiProperty({ description: 'Tiêu đề minh chứng NCKH' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết hoặc link bài báo / giải thưởng NCKH' })
  @IsOptional()
  @IsString()
  description?: string;
}
