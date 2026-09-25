import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-token-xyz', description: 'Token đặt lại mật khẩu một lần' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'NewPassword@123', description: 'Mật khẩu mới (tối thiểu 8 ký tự)' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  newPassword!: string;
}

