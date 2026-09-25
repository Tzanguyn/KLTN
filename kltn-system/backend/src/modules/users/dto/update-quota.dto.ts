import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateQuotaDto {
  @ApiProperty({ example: 6, description: 'Số nhóm hướng dẫn tối đa cho giảng viên' })
  @IsInt()
  @Min(1)
  @Max(20)
  maxGroups!: number;
}

