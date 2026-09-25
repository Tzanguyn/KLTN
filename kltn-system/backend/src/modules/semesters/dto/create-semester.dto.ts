import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SemesterStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSemesterDto {
  // --- Tên học kỳ / đợt KLTN ---
  @ApiPropertyOptional({
    description: 'Tên học kỳ / đợt KLTN (chuẩn tiếng Việt, vd: Đợt KLTN Học kỳ 1 năm 2026)',
    example: 'Đợt KLTN Học kỳ 1 năm 2026',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  tenHocKy?: string;

  @ApiPropertyOptional({
    description: 'Tên học kỳ (chuẩn tiếng Anh)',
    example: 'Semester 1 - 2026',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  // --- Năm học ---
  @ApiPropertyOptional({
    description: 'Năm học (chuẩn tiếng Việt, vd: 2026-2027)',
    example: '2026-2027',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  namHoc?: string;

  @ApiPropertyOptional({
    description: 'Năm học (chuẩn tiếng Anh, vd: 2026-2027)',
    example: '2026-2027',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  academicYear?: string;

  // --- Mã học kỳ / đợt ---
  @ApiPropertyOptional({
    description: 'Mã đợt / học kỳ (vd: 2026-KLTN-1). Nếu để trống sẽ tự động sinh mã.',
    example: '2026-KLTN-1',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  code?: string;

  @ApiPropertyOptional({
    description: 'Mã đợt / học kỳ (chuẩn tiếng Việt)',
    example: '2026-KLTN-1',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  maHocKy?: string;

  // --- Thời gian bắt đầu và kết thúc toàn đợt ---
  @ApiPropertyOptional({
    description: 'Thời gian bắt đầu đợt KLTN (ISO string)',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  thoiGianBatDau?: string;

  @ApiPropertyOptional({
    description: 'Thời gian kết thúc đợt KLTN (ISO string)',
    example: '2027-01-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  thoiGianKetThuc?: string;

  // --- Chi tiết các mốc thời gian ---
  @ApiPropertyOptional({
    description: 'Thời gian mở đăng ký đề tài (ISO string)',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  registrationFrom?: string;

  @ApiPropertyOptional({
    description: 'Thời gian bắt đầu đăng ký (tiếng Việt, ISO string)',
  })
  @IsOptional()
  @IsDateString()
  thoiGianBatDauDangKy?: string;

  @ApiPropertyOptional({
    description: 'Hạn chót đăng ký đề tài (ISO string)',
    example: '2026-10-01T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  registrationTo?: string;

  @ApiPropertyOptional({
    description: 'Hạn chót đăng ký đề tài (tiếng Việt, ISO string)',
  })
  @IsOptional()
  @IsDateString()
  thoiGianKetThucDangKy?: string;

  @ApiPropertyOptional({
    description: 'Hạn chót nộp báo cáo / khóa luận (ISO string)',
    example: '2026-12-01T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  submissionTo?: string;

  @ApiPropertyOptional({
    description: 'Hạn chót nộp báo cáo (tiếng Việt, ISO string)',
  })
  @IsOptional()
  @IsDateString()
  thoiGianNopBaoCao?: string;

  @ApiPropertyOptional({
    description: 'Thời gian bắt đầu bảo vệ (ISO string)',
    example: '2026-12-15T08:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  defenseFrom?: string;

  @ApiPropertyOptional({
    description: 'Thời gian bắt đầu bảo vệ (tiếng Việt, ISO string)',
  })
  @IsOptional()
  @IsDateString()
  thoiGianBatDauBaoVe?: string;

  @ApiPropertyOptional({
    description: 'Thời gian kết thúc bảo vệ / đợt (ISO string)',
    example: '2027-01-15T17:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  defenseTo?: string;

  @ApiPropertyOptional({
    description: 'Thời gian kết thúc bảo vệ (tiếng Việt, ISO string)',
  })
  @IsOptional()
  @IsDateString()
  thoiGianKetThucBaoVe?: string;

  // --- Bộ môn phụ trách ---
  @ApiPropertyOptional({
    description: 'ID bộ môn phụ trách (UUID). Nếu không truyền sẽ lấy bộ môn mặc định.',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'ID bộ môn phụ trách (chuẩn tiếng Việt, UUID)',
  })
  @IsOptional()
  @IsUUID()
  boMonId?: string;

  // --- Trạng thái đợt ---
  @ApiPropertyOptional({
    description: 'Trạng thái đợt KLTN (DRAFT, OPEN, CLOSED, ARCHIVED)',
    enum: SemesterStatus,
    default: SemesterStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(SemesterStatus)
  status?: SemesterStatus;

  @ApiPropertyOptional({
    description: 'Trạng thái đợt KLTN (chuẩn tiếng Việt)',
    enum: SemesterStatus,
  })
  @IsOptional()
  @IsEnum(SemesterStatus)
  trangThai?: SemesterStatus;
}

