import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class LecturerQuotaItemDto {
  @ApiProperty({ example: '320e8b39-165f-449e-b141-923cbcf56488', description: 'ID của giảng viên (lecturerProfileId hoặc userId)' })
  @IsNotEmpty({ message: 'lecturerId không được để trống' })
  @IsString()
  lecturerId!: string;

  @ApiProperty({ example: 5, description: 'Số nhóm hướng dẫn tối đa cho giảng viên trong học kỳ này' })
  @IsInt({ message: 'maxGroups phải là số nguyên' })
  @Min(1, { message: 'maxGroups tối thiểu là 1' })
  @Max(50, { message: 'maxGroups tối đa là 50' })
  maxGroups!: number;
}

export class UpdateSemesterQuotasDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'ID học kỳ áp dụng hạn mức' })
  @IsNotEmpty({ message: 'semesterId không được để trống' })
  @IsString()
  semesterId!: string;

  @ApiProperty({
    type: [LecturerQuotaItemDto],
    description: 'Danh sách hạn mức của các giảng viên',
  })
  @IsArray({ message: 'quotas phải là một danh sách' })
  @ArrayMinSize(1, { message: 'quotas phải có ít nhất 1 giảng viên' })
  @ValidateNested({ each: true })
  @Type(() => LecturerQuotaItemDto)
  quotas!: LecturerQuotaItemDto[];
}

