import { ApiPropertyOptional } from '@nestjs/swagger';
import { SubmissionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QuerySubmissionsDto {
  @ApiPropertyOptional({ description: 'Lọc theo ID đề tài' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID nhóm' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ngày bắt đầu nộp bài (ISO string hoặc YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Alias của startDate: thời gian bắt đầu' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ngày kết thúc nộp bài (ISO string hoặc YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Alias của endDate: thời gian kết thúc' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái bài nộp',
    enum: SubmissionStatus,
  })
  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

  @ApiPropertyOptional({ description: 'Loại bài nộp (ví dụ BAO_CAO_TIEN_DO, TAI_LIEU, MA_NGUON)' })
  @IsOptional()
  @IsString()
  type?: string;
}

