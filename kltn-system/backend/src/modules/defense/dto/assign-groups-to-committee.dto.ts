import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignGroupsToCommitteeDto {
  @ApiProperty({ description: 'ID của học kỳ KLTN' })
  @IsNotEmpty({ message: 'semesterId không được để trống' })
  @IsUUID('4', { message: 'semesterId phải là UUID hợp lệ' })
  semesterId!: string;

  @ApiProperty({ description: 'Danh sách ID các nhóm đề tài KLTN được phân công vào hội đồng', type: [String] })
  @IsArray({ message: 'groupIds phải là một mảng' })
  @IsUUID('4', { each: true, message: 'ID nhóm phải là UUID hợp lệ' })
  groupIds!: string[];
}
