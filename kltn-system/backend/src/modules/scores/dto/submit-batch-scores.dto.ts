import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriterionScoreItemDto {
  @ApiProperty({ description: 'ID tiêu chí (UUID, mã tiêu chí như TC01..TC10, hoặc số thứ tự 1..10)' })
  @IsNotEmpty()
  tieuChiId!: string | number;

  @ApiPropertyOptional({ description: 'Điểm đánh giá (thang 10)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  score?: number;

  @ApiPropertyOptional({ description: 'Alias cho điểm đánh giá' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  value?: number;

  @ApiPropertyOptional({ description: 'Alias tiếng Việt cho điểm' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  diem?: number;

  @ApiPropertyOptional({ description: 'Ghi chú đánh giá tiêu chí' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SubmitBatchScoresDto {
  @ApiPropertyOptional({ description: 'ID hoặc mã đề tài' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ description: 'ID nhóm (nếu có)' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({
    description: 'Vai trò người chấm',
    enum: ['HUONG_DAN', 'PHAN_BIEN', 'HOI_DONG'],
    default: 'HUONG_DAN',
  })
  @IsOptional()
  @IsString()
  role?: 'HUONG_DAN' | 'PHAN_BIEN' | 'HOI_DONG';

  @ApiProperty({ description: 'Danh sách điểm theo tiêu chí', type: [CriterionScoreItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreItemDto)
  scores!: CriterionScoreItemDto[];

  @ApiPropertyOptional({ description: 'Lưu nháp (true: có thể sửa tiếp, false: khóa điểm)', default: false })
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @ApiPropertyOptional({ description: 'Nhận xét tổng quát' })
  @IsOptional()
  @IsString()
  generalComment?: string;
}

