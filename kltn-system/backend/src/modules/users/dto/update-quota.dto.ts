import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateQuotaDto {
  @ApiProperty({ example: 6, description: 'Số nhóm hướng dẫn tối đa cho giảng viên (>= 0)' })
  @IsInt({ message: 'Hạn mức phải là số nguyên' })
  @Min(0, { message: 'Hạn mức hướng dẫn không được là số âm (tối thiểu là 0)' })
  @Max(50, { message: 'Hạn mức tối đa là 50 nhóm' })
  maxGroups!: number;
}

