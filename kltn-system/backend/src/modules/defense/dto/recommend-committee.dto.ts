import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecommendCommitteeDto {
  @ApiProperty({ description: 'ID học kỳ' })
  @IsNotEmpty({ message: 'semesterId không được để trống' })
  @IsUUID('4', { message: 'semesterId phải là UUID hợp lệ' })
  semesterId!: string;

  @ApiPropertyOptional({ description: 'Danh sách ID nhóm KLTN tham gia hội đồng' })
  @IsOptional()
  @IsArray({ message: 'groupIds phải là mảng' })
  @IsUUID('4', { each: true, message: 'Mỗi groupId phải là UUID hợp lệ' })
  groupIds?: string[];

  @ApiPropertyOptional({ description: 'Danh sách ID đề tài KLTN' })
  @IsOptional()
  @IsArray({ message: 'topicIds phải là mảng' })
  @IsUUID('4', { each: true, message: 'Mỗi topicId phải là UUID hợp lệ' })
  topicIds?: string[];

  @ApiPropertyOptional({ description: 'ID khoa / bộ môn' })
  @IsOptional()
  @IsUUID('4', { message: 'departmentId phải là UUID hợp lệ' })
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Số lượng thành viên hội đồng mong muốn (tối thiểu 3)', default: 3 })
  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(7)
  committeeSize?: number;
}
