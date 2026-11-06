import { ApiProperty } from '@nestjs/swagger';
import { RoleCode } from '@prisma/client';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class TransferLeadershipDto {
  @ApiProperty({
    enum: [RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON],
    example: RoleCode.TRUONG_BO_MON,
    description: 'Vai trò chức vụ cần chuyển giao (TRUONG_BO_MON hoặc QUAN_LY_BO_MON)',
  })
  @IsIn([RoleCode.TRUONG_BO_MON, RoleCode.QUAN_LY_BO_MON, 'TRUONG_BO_MON', 'QUAN_LY_BO_MON'], {
    message: 'Vai trò chuyển giao phải là TRUONG_BO_MON hoặc QUAN_LY_BO_MON',
  })
  @IsNotEmpty({ message: 'Vui lòng chọn chức vụ cần chuyển giao' })
  role!: 'TRUONG_BO_MON' | 'QUAN_LY_BO_MON';

  @ApiProperty({
    example: 'd9b2d63d-a233-4f9e-990e-b9b5f928e3b1',
    description: 'ID người dùng (UUID) của giảng viên kế nhiệm nhận bàn giao chức vụ',
  })
  @IsString({ message: 'ID nhân sự kế nhiệm phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng chọn nhân sự kế nhiệm' })
  successorUserId!: string;
}
