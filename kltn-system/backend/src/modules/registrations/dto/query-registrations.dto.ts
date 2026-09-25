import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryRegistrationsDto {
  @ApiPropertyOptional({ description: 'ID học kỳ / đợt KLTN' })
  @IsOptional()
  @IsString()
  semesterId?: string;

  @ApiPropertyOptional({ description: 'Lớp sinh viên (tìm kiếm theo className)' })
  @IsOptional()
  @IsString()
  lop?: string;

  @ApiPropertyOptional({ description: 'Ngành / Bộ môn / Khoa (ID, mã code hoặc tên ngành)' })
  @IsOptional()
  @IsString()
  nganh?: string;

  @ApiPropertyOptional({ description: 'Trạng thái đơn đăng ký' })
  @IsOptional()
  @IsString()
  status?: string;
}

