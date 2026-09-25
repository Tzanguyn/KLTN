import { IsBoolean, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateEligibilityDto {
  @ApiProperty({ example: true, description: 'Trạng thái đủ điều kiện làm KLTN' })
  @IsBoolean()
  eligible!: boolean;

  @ApiProperty({ example: 120, required: false, description: 'Số tín chỉ tích lũy' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditsEarned?: number;
}

