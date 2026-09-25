import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateSubmissionDto {
  @ApiPropertyOptional({
    description: 'Loại bài nộp: BAO_CAO_TIEN_DO | TAI_LIEU | MA_NGUON | LINK_DEMO | BAO_CAO_GIUA_KY | BAO_CAO_CUOI_KY',
    default: 'BAO_CAO_TIEN_DO',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Đường dẫn liên kết (GitHub, Google Drive, Demo URL, ...)' })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional({ description: 'Ghi chú cho giảng viên hướng dẫn' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'ID của đề tài KLTN' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ description: 'ID của nhóm KLTN' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ description: 'ID của mốc báo cáo (nếu nộp theo mốc cụ thể)' })
  @IsOptional()
  @IsString()
  reportId?: string;
}

