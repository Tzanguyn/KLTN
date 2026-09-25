import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'sinhvien@kltn.edu.vn', description: 'Email tài khoản cần khôi phục' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;
}

