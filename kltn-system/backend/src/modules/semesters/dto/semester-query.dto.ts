import { ApiPropertyOptional } from '@nestjs/swagger';
import { SemesterStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class SemesterQueryDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên hoặc mã học kỳ' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (alias tiếng Việt)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái đợt',
    enum: SemesterStatus,
  })
  @IsOptional()
  @IsEnum(SemesterStatus)
  status?: SemesterStatus;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái (tiếng Việt)' })
  @IsOptional()
  @IsEnum(SemesterStatus)
  trangThai?: SemesterStatus;

  @ApiPropertyOptional({ description: 'Lọc theo năm học (vd: 2026-2027)' })
  @IsOptional()
  @IsString()
  academicYear?: string;

  @ApiPropertyOptional({ description: 'Lọc theo năm học (tiếng Việt)' })
  @IsOptional()
  @IsString()
  namHoc?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID bộ môn' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID bộ môn (tiếng Việt)' })
  @IsOptional()
  @IsUUID()
  boMonId?: string;
}

