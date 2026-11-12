import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email trường cấp hoặc Mã số sinh viên (MSSV)',
    example: 'sinhvien@kltn.edu.vn',
  })
  @IsString({ message: 'MSSV hoặc email phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập MSSV hoặc email' })
  identifier!: string;

  @ApiProperty({
    description: 'Mật khẩu tài khoản (tối thiểu 8 ký tự)',
    example: 'Password@123',
    minLength: 8,
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  password!: string;

  @ApiPropertyOptional({
    description: 'Mã định danh CAPTCHA (nhận từ API GET /api/auth/captcha)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString({ message: 'Mã định danh CAPTCHA phải là chuỗi ký tự' })
  captchaId?: string;

  @ApiPropertyOptional({
    description: 'Mã xác nhận (CAPTCHA) người dùng nhập',
    example: 'A7K9',
  })
  @IsOptional()
  @IsString({ message: 'Mã xác nhận CAPTCHA phải là chuỗi ký tự' })
  captchaCode?: string;
}
