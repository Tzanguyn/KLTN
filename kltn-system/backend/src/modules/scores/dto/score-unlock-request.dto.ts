import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScoreUnlockRequestDto {
  @ApiProperty({ description: 'Lý do xin mở khóa sửa điểm gửi Trưởng bộ môn' })
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ description: 'ID hoặc mã đề tài (nếu không truyền groupId)' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ description: 'ID nhóm' })
  @IsOptional()
  @IsString()
  groupId?: string;
}

