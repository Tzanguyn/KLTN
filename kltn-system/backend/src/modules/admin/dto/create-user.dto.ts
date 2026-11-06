import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleCode, UserStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'nguyenvana@kltn.edu.vn' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'Password@123' })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có tối thiểu 8 ký tự' })
  password?: string;

  @ApiPropertyOptional({ example: '0987654321' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: RoleCode, example: RoleCode.SINH_VIEN })
  @IsEnum(RoleCode, { message: 'Vai trò không hợp lệ' })
  role!: RoleCode;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

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

  @ApiPropertyOptional({ example: 'CNTT' })
  @IsOptional()
  @IsString()
  departmentCode?: string;
}
