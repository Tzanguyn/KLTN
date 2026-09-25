import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

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
}
