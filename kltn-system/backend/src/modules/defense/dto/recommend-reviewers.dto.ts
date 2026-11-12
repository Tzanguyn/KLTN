import { IsOptional, IsString, IsUUID, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RecommendReviewersDto {
  @ApiPropertyOptional({ description: 'ID nhóm KLTN cần đề xuất GVPB' })
  @IsOptional()
  @IsUUID('4', { message: 'groupId phải là UUID hợp lệ' })
  groupId?: string;

  @ApiPropertyOptional({ description: 'ID đề tài KLTN' })
  @IsOptional()
  @IsUUID('4', { message: 'topicId phải là UUID hợp lệ' })
  topicId?: string;

  @ApiPropertyOptional({ description: 'Tên đề tài (nếu phân tích trực tiếp đề tài chưa lưu)' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Mô tả tóm tắt đề tài' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: 'Mục tiêu đề tài' })
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional({ description: 'Công nghệ sử dụng' })
  @IsOptional()
  @IsString()
  technologies?: string;

  @ApiPropertyOptional({ description: 'ID học kỳ' })
  @IsOptional()
  @IsUUID('4', { message: 'semesterId phải là UUID hợp lệ' })
  semesterId?: string;

  @ApiPropertyOptional({ description: 'Số lượng giảng viên gợi ý hàng đầu', default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(20)
  topN?: number;
}
