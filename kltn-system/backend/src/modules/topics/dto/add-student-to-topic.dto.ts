import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddStudentToTopicDto {
  @ApiProperty({ description: 'ID của sinh viên (StudentProfile ID hoặc User ID hoặc MSSV)' })
  @IsNotEmpty({ message: 'studentId không được để trống' })
  @IsString()
  studentId!: string;

  @ApiProperty({ required: false, description: 'Trạng thái đăng ký (APPROVED / DA_XAC_NHAN hoặc CHO_XAC_NHAN)' })
  @IsOptional()
  @IsString()
  status?: string;
}
