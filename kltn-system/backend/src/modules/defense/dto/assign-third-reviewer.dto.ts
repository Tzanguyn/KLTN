import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignThirdReviewerDto {
  @ApiProperty({ description: 'ID nhóm KLTN cần phân công GVPB thứ 3' })
  @IsNotEmpty({ message: 'groupId không được để trống' })
  @IsUUID('4', { message: 'groupId phải là UUID hợp lệ' })
  groupId!: string;

  @ApiProperty({ description: 'ID hồ sơ Giảng viên phản biện thứ 3' })
  @IsNotEmpty({ message: 'reviewerId không được để trống' })
  @IsUUID('4', { message: 'reviewerId phải là UUID hợp lệ' })
  reviewerId!: string;

  @ApiPropertyOptional({ description: 'Ghi chú lý do phân công GVPB thứ 3' })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự' })
  note?: string;
}
