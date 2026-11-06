import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoleCode, UserStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'nguyenvana@kltn.edu.vn' })
  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '0987654321' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: RoleCode })
  @IsOptional()
  @IsEnum(RoleCode)
  role?: RoleCode;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'Password@123' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có tối thiểu 8 ký tự' })
  password?: string;

  // Trường dành cho Sinh viên
  @ApiPropertyOptional({ example: 'SV2026999' })
  @IsOptional()
  @IsString()
  studentCode?: string;

  @ApiPropertyOptional({ example: 'CNTT K2026' })
  @IsOptional()
  @IsString()
  className?: string;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsNumber()
  cohort?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsNumber()
  creditsEarned?: number;

  @ApiPropertyOptional({ example: 3.2 })
  @IsOptional()
  @IsNumber()
  gpa?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  eligible?: boolean;

  // Trường dành cho Giảng viên / Trưởng bộ môn
  @ApiPropertyOptional({ example: 'GV999' })
  @IsOptional()
  @IsString()
  lecturerCode?: string;

  @ApiPropertyOptional({ example: 'TS.' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Kỹ thuật phần mềm' })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  maxGroups?: number;
}

export class UpdateUserStatusDto {
  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.LOCKED })
  @IsEnum(UserStatus, { message: 'Trạng thái không hợp lệ' })
  status!: UserStatus;

  @ApiPropertyOptional({ example: 'Vi phạm quy chế học vụ' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResetPasswordAdminDto {
  @ApiPropertyOptional({ example: 'Password@123' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có tối thiểu 8 ký tự' })
  newPassword?: string;
}
