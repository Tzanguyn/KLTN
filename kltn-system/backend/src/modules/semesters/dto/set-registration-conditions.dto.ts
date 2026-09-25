import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SetRegistrationConditionsDto {
  @ApiPropertyOptional({
    description: 'Số tín chỉ tích lũy tối thiểu để đủ điều kiện đăng ký KLTN (vd: 110 hoặc 120)',
    example: 110,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minCredits?: number;

  @ApiPropertyOptional({
    description: 'Số tín chỉ tối thiểu (chuẩn tiếng Việt)',
    example: 110,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  soTinChiToiThieu?: number;

  @ApiPropertyOptional({
    description: 'Điểm trung bình tích lũy (GPA) tối thiểu (vd: 2.0 hoặc 2.5)',
    example: 2.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  minGpa?: number;

  @ApiPropertyOptional({
    description: 'Điểm trung bình tối thiểu (chuẩn tiếng Việt)',
    example: 2.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  diemTBToiThieu?: number;

  @ApiPropertyOptional({
    description: 'Điểm trung bình tối thiểu (alias tiếng Việt khác)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  diemTB?: number;

  @ApiPropertyOptional({
    description: 'Danh sách mã môn hoặc tên các môn tiên quyết bắt buộc phải hoàn thành',
    example: ['INT3306', 'INT3307'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisiteCourses?: string[];

  @ApiPropertyOptional({
    description: 'Môn tiên quyết (chuẩn tiếng Việt)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  monTienQuyet?: string[];

  @ApiPropertyOptional({
    description: 'Yêu cầu sinh viên phải có cờ eligible = true',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  requireEligibleFlag?: boolean;

  @ApiPropertyOptional({
    description: 'Yêu cầu đủ điều kiện (chuẩn tiếng Việt)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  yeuCauDuDieuKien?: boolean;

  @ApiPropertyOptional({
    description: 'Ghi chú / Mô tả về điều kiện đăng ký',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Mô tả (chuẩn tiếng Việt)',
  })
  @IsOptional()
  @IsString()
  moTa?: string;
}

