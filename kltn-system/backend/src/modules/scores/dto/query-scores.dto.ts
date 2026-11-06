import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryScoresDto {
  @ApiPropertyOptional({ description: 'ID học kỳ / đợt KLTN' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID nhóm KLTN' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ description: 'Chỉ lọc các nhóm có điểm chưa đầy đủ hoặc có cảnh báo' })
  @IsOptional()
  @IsBooleanString()
  incompleteOnly?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (mã nhóm, tên nhóm, tên đề tài, tên GVHD, tên SV)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID Giảng viên hướng dẫn (userId hoặc lecturerProfileId)' })
  @IsOptional()
  @IsString()
  lecturerId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID Giảng viên hướng dẫn (gvhdId)' })
  @IsOptional()
  @IsString()
  gvhdId?: string;
}

